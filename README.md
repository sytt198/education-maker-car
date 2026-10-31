# SophiMotion 教育版小车参数工作台

[在线预览](https://sytt198.github.io/education-maker-car/) · [源码](https://github.com/sytt198/education-maker-car)

默认模型直接由教育版 V5 的106个实际CAD分件转换，保留竖立Mosaico、五孔打印轮、后轮双N20驱动、前轮独立从动、底置CyberBrick电池和45mm PCB；不是概念图重画的小车。

## 运行

需要Node22。首次克隆运行 npm ci，随后 npm test、npm run models、npm run build、npm start。在浏览器打开 http://127.0.0.1:5180/ 。本机也可双击 Launch Website.cmd。

## 参数与装配

- 底盘长度90–150mm连续可调。轴距=长度−38mm，前轮组向前、后电机/轮组与屏幕支架向后各移动长度增量的一半；PCB和电池保留中部。
- 轮径40–60mm、轮宽10–16mm；前后轮间隙至少6mm。轮心高度随半径变化。
- 保留全部原始轮毂孔位、轴承座、D轴与紧固件；在原轮外周加打印外环来改变尺寸，增加宽度向车身外侧展开。轮胎统一颜色传递到Fusion外观。
- 轮毂轴向安装中心距86mm不变；接地外圈的有效轮距随向外加宽变化，控制代码采用该有效轮距。
- 默认尺寸逐件直接使用来源网格。变长底盘重新生成板面与安装孔、盲孔柱、螺母口袋和前轮螺钉扫掠避让。

教师工作台包括装配树/显隐/爆炸/正交视图/截图、BOM多套备料/单价/CSV、电气架构与GPIO编辑、运动预览与ESP-IDF模块、Fusion交接。未知价格、GPIO和电机额定值不填入虚构数据；预览不会连接硬件。

## Fusion 导出

点击“导出Fusion”下载EducationCar重建包。解压，在Fusion“实用工具 → 脚本和附加模块”中从设备添加EducationCar文件夹并运行。脚本新建设计、导入原始STEP、重建当前可变几何与四个轮轴关节，成功后在output/生成F3D、STEP、运行报告和截图。

网页不能直接在浏览器里写出原生F3D；提供的基准V5 F3D对应默认机械来源，不能冒充任意当前参数的导出结果。Fusion参数登记当前快照；修改网页参数并重新导出/运行可重建，导入电机等零件不会被整体缩放。

## 验证与来源

- npm test：配置/装配公式、原模型网格逐顶点保留、标准件不缩放、整电机/轴承采购去重、当前参数ZIP、TB6612模板。
- npm run models：106个原始STEP SHA256、网格索引和交接文件完整性检查。
- docs/cad-verification.json：源CAD环境使用CadQuery独立构造同参数实体并做静态交集检查的记录。默认90/40/10和130/52/14组合通过实体有效性与静态交集检查。
- 固件采用ESP32-C6 / TB6612，7个信号PWMA/AIN1/AIN2/PWMB/BIN1/BIN2/STBY独立配置。未填写GPIO时头文件阻止编译。固件尚未编译烧录；Mosaico板间协议与实际电源仍需联调。

数字静态检查不等于全部连续参数已完成动态扫掠、公差、强度或实物试装。PCB39mm孔距、厚度及Mosaico包络仍需实测。基准来源为原项目refined-car-v5；本仓库已包含独立运行/导出所需资源，不依赖原电脑目录。

当前入口是src/education/。本仓库只包含当前教育版网页与其资源。

Fusion原生运行已在130mm底盘、52mm轮径、14mm轮宽配置完成，生成106组件、4旋转关节的F3D和STEP；记录见docs/fusion-runtime-verification.json。运行报告未发现外观警告。此结果不代表每个连续参数组合均已实物验证。
