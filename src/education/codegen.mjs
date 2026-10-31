import {SIGNALS,validateEducation,dimensions} from './project.mjs';
export function generateControl(c){const errors=validateEducation(c);if(errors.length)throw Error(errors.join('\n'));const ready=SIGNALS.every(k=>c.pins[k]!==null),d=dimensions(c);
const header=`#pragma once
// ESP32-C6 / TB6612. Verify PCB routing and motor electrical ratings before use.
${ready?'':'#error "Assign and verify all seven TB6612 GPIO signals before compiling."'}
${SIGNALS.map(k=>`#define PIN_${k} ${c.pins[k]??-1}`).join('\n')}
#define WHEEL_DIAMETER_MM ${c.geometry.wheelDiameter}
#define WHEEL_TRACK_MM ${d.wheelTrack}
#define WHEELBASE_MM ${d.wheelbase}
#define ESTIMATED_RPM ${Number(c.motion.outputRPM).toFixed(3)}f
#define MAX_DUTY_PERCENT ${c.motion.maxDuty}
#define WATCHDOG_MS ${c.motion.watchdogMs}
#define LEFT_SIGN ${c.motion.leftSign}
#define RIGHT_SIGN ${c.motion.rightSign}
// ESTIMATED_RPM is a user estimate, not a measured specification.
`;
const source=`#include "car.h"
#include "car_config.h"
#include <math.h>
#include <stdint.h>
#include "driver/gpio.h"
#include "driver/ledc.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "esp_timer.h"
#include "esp_check.h"
typedef struct { float linear, angular; int64_t received_us; } command_t;
static QueueHandle_t commands;
static int last_sign[2] = {0,0};
static const int direction[2][2]={{PIN_AIN1,PIN_AIN2},{PIN_BIN1,PIN_BIN2}};
static void pwm(int channel,int value){
  ESP_ERROR_CHECK(ledc_set_duty(LEDC_LOW_SPEED_MODE,channel,value));
  ESP_ERROR_CHECK(ledc_update_duty(LEDC_LOW_SPEED_MODE,channel));
}
static void standby(void){
  pwm(0,0);pwm(1,0);gpio_set_level(PIN_STBY,0);
  for(int i=0;i<2;i++){gpio_set_level(direction[i][0],0);gpio_set_level(direction[i][1],0);}
  // Keep last_sign across explicit stops, so stop/reverse still observes dead time.
}
static void output(float left,float right){
  float values[2]={left*LEFT_SIGN,right*RIGHT_SIGN};
  if(fabsf(values[0])+fabsf(values[1])<0.00001f){standby();return;}
  int reversing=0;
  for(int i=0;i<2;i++){int sign=(values[i]>0)-(values[i]<0);if(sign&&last_sign[i]&&sign!=last_sign[i])reversing=1;}
  if(reversing){standby();vTaskDelay(pdMS_TO_TICKS(40));}
  gpio_set_level(PIN_STBY,1);
  for(int i=0;i<2;i++){
    int sign=(values[i]>0)-(values[i]<0);
    pwm(i,0);gpio_set_level(direction[i][0],sign>0);gpio_set_level(direction[i][1],sign<0);
    pwm(i,(int)lroundf(fminf(fabsf(values[i]),MAX_DUTY_PERCENT/100.0f)*1023));
    if(sign)last_sign[i]=sign;
  }
}
static void control_task(void *arg){
  command_t current={0};
  while(1){
    command_t incoming;if(xQueueReceive(commands,&incoming,pdMS_TO_TICKS(10))==pdTRUE)current=incoming;
    if(!current.received_us||esp_timer_get_time()-current.received_us>WATCHDOG_MS*1000LL){standby();continue;}
    float left=(current.linear-current.angular*WHEEL_TRACK_MM/2000.0f)*60000.0f/(3.14159265f*WHEEL_DIAMETER_MM);
    float right=(current.linear+current.angular*WHEEL_TRACK_MM/2000.0f)*60000.0f/(3.14159265f*WHEEL_DIAMETER_MM);
    float limit=ESTIMATED_RPM*MAX_DUTY_PERCENT/100.0f;
    float scale=fmaxf(1,fmaxf(fabsf(left),fabsf(right))/limit);
    output(left/scale/ESTIMATED_RPM,right/scale/ESTIMATED_RPM);
  }
}
esp_err_t car_init(void){
  if(commands)return ESP_ERR_INVALID_STATE;
  const int pins[]={PIN_AIN1,PIN_AIN2,PIN_BIN1,PIN_BIN2,PIN_STBY};
  for(int i=0;i<5;i++)if(!GPIO_IS_VALID_OUTPUT_GPIO(pins[i]))return ESP_ERR_INVALID_ARG;
  if(!GPIO_IS_VALID_OUTPUT_GPIO(PIN_PWMA)||!GPIO_IS_VALID_OUTPUT_GPIO(PIN_PWMB))return ESP_ERR_INVALID_ARG;
  for(int i=0;i<5;i++){ESP_RETURN_ON_ERROR(gpio_set_direction(pins[i],GPIO_MODE_OUTPUT),"car","GPIO setup");gpio_set_level(pins[i],0);}
  ledc_timer_config_t timer={.speed_mode=LEDC_LOW_SPEED_MODE,.duty_resolution=LEDC_TIMER_10_BIT,.timer_num=LEDC_TIMER_0,.freq_hz=20000,.clk_cfg=LEDC_AUTO_CLK};
  ESP_RETURN_ON_ERROR(ledc_timer_config(&timer),"car","PWM timer");
  const int pwm_pins[]={PIN_PWMA,PIN_PWMB};
  for(int i=0;i<2;i++){ledc_channel_config_t channel={.gpio_num=pwm_pins[i],.speed_mode=LEDC_LOW_SPEED_MODE,.channel=i,.timer_sel=LEDC_TIMER_0,.duty=0,.hpoint=0};ESP_RETURN_ON_ERROR(ledc_channel_config(&channel),"car","PWM channel");}
  commands=xQueueCreate(1,sizeof(command_t));if(!commands)return ESP_ERR_NO_MEM;
  standby();if(xTaskCreate(control_task,"car",3072,NULL,5,NULL)!=pdPASS){vQueueDelete(commands);commands=NULL;return ESP_ERR_NO_MEM;}return ESP_OK;
}
esp_err_t car_set_velocity(float linear_m_s,float angular_rad_s){
  if(!commands)return ESP_ERR_INVALID_STATE;
  if(!isfinite(linear_m_s)||!isfinite(angular_rad_s)||fabsf(linear_m_s)>0.5f||fabsf(angular_rad_s)>6.0f){car_stop();return ESP_ERR_INVALID_ARG;}
  command_t c={linear_m_s,angular_rad_s,esp_timer_get_time()};
  return xQueueOverwrite(commands,&c)==pdPASS?ESP_OK:ESP_FAIL;
}
void car_stop(void){if(commands){command_t c={0};xQueueOverwrite(commands,&c);}}
`;
return {'car_config.h':header,'car.c':source,'car.h':`#pragma once
#include "esp_err.h"
// All hardware writes occur in a single control task. Call from task context.
esp_err_t car_init(void);
esp_err_t car_set_velocity(float linear_m_s,float angular_rad_s);
void car_stop(void);
`,'CMakeLists.txt':'idf_component_register(SRCS "car.c" INCLUDE_DIRS "." REQUIRES driver esp_timer)\n','README.md':`# 教育版 ESP32-C6 / TB6612 集成模块\n\n放入 ESP-IDF 工程 components/car。调用 car_init() 后以小于 ${c.motion.watchdogMs} ms 的间隔提交 car_set_velocity(m/s, rad/s)；car_stop() 停止。PWMA/B 使用 LEDC 低速模式。未核定全部 GPIO 时头文件阻止编译。输出转速仅为预览估值，未知额定电压与堵转电流未推断。\n\nMosaico 通信协议、接收校验和失联上报由实际应用集成，本模块不会自行初始化 UART。尚未编译或实机验收。\n\nAPI依据：https://docs.espressif.com/projects/esp-idf/en/latest/esp32c6/api-reference/peripherals/ledc.html\n`};}
