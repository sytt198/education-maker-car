"""Build the education car using original STEP bodies and the web geometry recipe.
Run in Autodesk Fusion. No source document is modified. Units in files are mm.
"""
import os,json,math,hashlib,traceback
import adsk
import adsk.core as C
import adsk.fusion as F
HERE=os.path.dirname(os.path.abspath(__file__))

def point(x,y,z=0):return C.Point3D.create(x/10,y/10,z/10)
def value(mm):return C.ValueInput.createByString(str(mm)+' mm')
def objects(items):
    result=C.ObjectCollection.create()
    for item in items:result.add(item)
    return result
def bodies(comp):
    result=[comp.bRepBodies.item(i) for i in range(comp.bRepBodies.count)]
    for i in range(comp.occurrences.count):result+=bodies(comp.occurrences.item(i).component)
    return result
def plane(comp,base,offset):
    inp=comp.constructionPlanes.createInput();inp.setByOffset(base,value(offset))
    p=comp.constructionPlanes.add(inp);p.isLightBulbOn=False;return p
def sketch_xy(comp,z,name):
    sk=comp.sketches.add(plane(comp,comp.xYConstructionPlane,z));sk.name=name;return sk
def extrude(comp,sk,height,operation,name,profile=None):
    profile=profile or objects([sk.profiles.item(i) for i in range(sk.profiles.count)])
    if not sk.profiles.count:raise RuntimeError('No closed profile: '+name)
    feature=comp.features.extrudeFeatures.addSimple(profile,value(height),operation)
    if not feature:raise RuntimeError('Extrusion failed: '+name)
    feature.name=name;sk.isVisible=False;return feature
def circle(sk,x,y,r):return sk.sketchCurves.sketchCircles.addByCenterRadius(point(x,y),r/10)
def rounded(sk,width,length,r):
    x=100-width/2;y=100-length/2;w=width;l=length;k=math.sqrt(.5)
    lines=sk.sketchCurves.sketchLines;arcs=sk.sketchCurves.sketchArcs
    for a,b in [((x+r,y),(x+w-r,y)),((x+w,y+r),(x+w,y+l-r)),((x+w-r,y+l),(x+r,y+l)),((x,y+l-r),(x,y+r))]:lines.addByTwoPoints(point(*a),point(*b))
    for a,m,b in [((x+w-r,y),(x+w-r+r*k,y+r-r*k),(x+w,y+r)),((x+w,y+l-r),(x+w-r+r*k,y+l-r+r*k),(x+w-r,y+l)),((x+r,y+l),(x+r-r*k,y+l-r+r*k),(x,y+l-r)),((x,y+r),(x+r-r*k,y+r-r*k),(x+r,y))]:arcs.addByThreePoints(point(*a),point(*m),point(*b))
def build_chassis(comp,ch):
    sk=sketch_xy(comp,26,'Deck outline — original 70mm width, R5 corners');rounded(sk,70,ch['length'],5)
    extrude(comp,sk,3,F.FeatureOperations.NewBodyFeatureOperation,'Parametric deck')
    sk=sketch_xy(comp,26,'Mounting holes — axle groups follow length')
    for h in ch['holes']:circle(sk,h['x'],h['y'],h['r'])
    extrude(comp,sk,3,F.FeatureOperations.CutFeatureOperation,'M2 mounting holes')
    sk=sketch_xy(comp,29,'Original PCB bosses')
    for b in ch['bosses']:circle(sk,b['x'],b['y'],b['r'])
    extrude(comp,sk,5.5,F.FeatureOperations.JoinFeatureOperation,'PCB bosses — unchanged interface')
    sk=sketch_xy(comp,31.3,'Blind insert installation bores')
    for b in ch['bosses']:circle(sk,b['x'],b['y'],b['bore'])
    extrude(comp,sk,3.2,F.FeatureOperations.CutFeatureOperation,'Blind M2 insert bores')
    sk=sketch_xy(comp,26,'Original captive nut pockets')
    for x,y in [(76,ch['frontY']-4),(124,ch['frontY']-4)]+[(x,y+ch['rearDelta']) for x in (68,132) for y in (105,117)]:
        pts=[point(x+4.2/(2*math.cos(math.pi/6))*math.cos(i*math.pi/3),y+4.2/(2*math.cos(math.pi/6))*math.sin(i*math.pi/3)) for i in range(6)]
        for i in range(6):sk.sketchCurves.sketchLines.addByTwoPoints(pts[i],pts[(i+1)%6])
    extrude(comp,sk,1.8,F.FeatureOperations.CutFeatureOperation,'M2 nut pockets')
    for x in (64.8,132.8):
        sk=comp.sketches.add(plane(comp,comp.yZConstructionPlane,x));sk.name='Front fastener sweep clearance'
        center=sk.modelToSketchSpace(point(x,ch['frontY'],20))
        sk.sketchCurves.sketchCircles.addByCenterRadius(center,.73)
        extrude(comp,sk,2.4,F.FeatureOperations.CutFeatureOperation,'R7.3 fastener sweep clearance')

def extend_wheel(body,item,extension,wheel):
    # Keep every supplied hub/seat/retaining feature. Add a peripheral printed band.
    comp=body.parentComponent;center=wheel['center'];translation=item['translation']
    center=[center[i]-translation[i] for i in range(3)]
    center[0]+=(-1 if item['id'].endswith('left') else 1)*(extension['width']-10)/2
    x=center[0]-extension['width']/2
    sk=comp.sketches.add(plane(comp,comp.yZConstructionPlane,x));sk.name='Wheel peripheral band — fixed original hub'
    cp=sk.modelToSketchSpace(point(x,center[1],center[2]))
    for radius in (extension['outerRadius'],extension['innerRadius']):sk.sketchCurves.sketchCircles.addByCenterRadius(cp,radius/10)
    annulus=next((sk.profiles.item(i) for i in range(sk.profiles.count) if sk.profiles.item(i).profileLoops.count==2),None)
    if not annulus:raise RuntimeError('Missing annular wheel profile')
    extrude(comp,sk,extension['width'],F.FeatureOperations.JoinFeatureOperation,'Wheel outer band',annulus)

def appearance(app,design,color,key):
    rgb=[round(v*255) for v in color] if not isinstance(color,str) else [int(color[i:i+2],16) for i in (1,3,5)]
    name='Education-'+key;existing=design.appearances.itemByName(name)
    candidate=None
    for i in range(app.materialLibraries.count):
        lib=app.materialLibraries.item(i)
        for j in range(lib.appearances.count):
            ap=lib.appearances.item(j)
            if any(ap.appearanceProperties.item(k).id in ('opaque_albedo','generic_diffuse') for k in range(ap.appearanceProperties.count)):
                candidate=ap;break
        if candidate:break
    if not candidate:raise RuntimeError('No recolorable material appearance found')
    ap=existing or design.appearances.addByCopy(candidate,name)
    prop=next((C.ColorProperty.cast(ap.appearanceProperties.item(i)) for i in range(ap.appearanceProperties.count) if ap.appearanceProperties.item(i).id in ('opaque_albedo','generic_diffuse')),None)
    if not prop:raise RuntimeError('No appearance color property')
    prop.value=C.Color.create(*rgb,255);return ap

def build(app,root_path=HERE):
    with open(os.path.join(root_path,'recipe.json'),encoding='utf-8-sig') as stream:r=json.load(stream)
    with open(os.path.join(root_path,'project.json'),encoding='utf-8-sig') as stream:config=json.load(stream)
    if r.get('schema')!='education-recipe/1' or config!=r.get('config'):raise ValueError('Project and recipe differ; re-export from web')
    g=config['geometry'];length=g['length'];diam=g['wheelDiameter'];width=g['wheelWidth']
    if not (90<=length<=150 and 40<=diam<=60 and 10<=width<=16 and length-38>=diam+6):raise ValueError('Unsafe parameter combination')
    if len(r['parts'])!=106 or len(r['wheels'])!=4:raise ValueError('Incomplete source assembly')
    for item in r['parts']:
        part_id=item['id']
        if not part_id or '..' in part_id or part_id.startswith('.') or any(not (c.isalnum() or c in '_.-') for c in part_id):raise ValueError('Invalid part id '+part_id)
        path=os.path.join(root_path,'step',part_id+'.step')
        if hashlib.sha256(open(path,'rb').read()).hexdigest()!=item['source_sha256']:raise ValueError('Source STEP hash mismatch '+part_id)
    doc=app.documents.add(C.DocumentTypes.FusionDesignDocumentType)
    design=F.Design.cast(app.activeProduct)
    if hasattr(design,'designIntent'):design.designIntent=F.DesignIntentTypes.HybridDesignIntentType
    design.designType=F.DesignTypes.ParametricDesignType
    root=design.rootComponent
    for name,num in [('chassis_length',length),('wheel_diameter',diam),('wheel_width',width),('wheelbase',length-38)]:design.userParameters.add(name,value(num),'mm','Current web snapshot; rerun script with a newly exported recipe to rebuild.')
    occurrences={};groups={};warnings=[];reports=[]
    wheels={w['id']:w for w in r['wheels']}
    for i,item in enumerate(r['parts']):
        occ=root.occurrences.addNewComponent(C.Matrix3D.create());comp=occ.component;comp.name=item['id'];comp.partNumber=item['id']
        occ.isGrounded=False
        if hasattr(occ,'isGroundToParent'):occ.isGroundToParent=False
        if item['id']=='chassis' and length!=90:build_chassis(comp,r['chassis'])
        else:
            opts=app.importManager.createSTEPImportOptions(os.path.join(root_path,'step',item['id']+'.step'));opts.isViewFit=False
            app.importManager.importToTarget2(opts,comp)
            if item['id'] in wheels and (diam!=40 or width!=10):extend_wheel(bodies(comp)[0],item,r['wheelExtension'],wheels[item['id']])
        all_bodies=bodies(comp)
        if not all_bodies or any(not b.isSolid for b in all_bodies):raise RuntimeError('Missing/invalid solid '+item['id'])
        transform=C.Matrix3D.create();transform.translation=C.Vector3D.create(*[v/10 for v in item['translation']]);occ.transform2=transform
        try:
            ap=appearance(app,design,item.get('color') or item['color_rgb'],item['id'])
            occ.appearance=ap
            for body in all_bodies:body.appearance=ap
        except Exception as err:warnings.append('Appearance '+item['id']+': '+str(err))
        occurrences[item['id']]=occ;groups.setdefault(item['motion_group'],[]).append(occ)
        reports.append({'id':item['id'],'solid_count':len(all_bodies),'source_sha256':item['source_sha256'],'translation_mm':item['translation']})
        if i%8==0:adsk.doEvents()
    chassis=occurrences['chassis']
    for key,members in groups.items():
        if len(members)>1:root.rigidGroups.add(objects(members),True).name='Rigid '+key
    for w in r['wheels']:
        sk=sketch_xy(root,w['center'][2],'Wheel rotation center '+w['group'])
        sp=sk.sketchPoints.add(point(w['center'][0],w['center'][1]));sp.isFixed=True;sk.isVisible=False
        inp=root.asBuiltJoints.createInput(chassis,occurrences[w['id']],F.JointGeometry.createByPoint(sp))
        inp.setAsRevoluteJointMotion(F.JointDirections.XAxisJointDirection)
        root.asBuiltJoints.add(inp).name=w['group']
    chassis.isGrounded=True;root.isJointsFolderLightBulbOn=False
    design.computeAll();failed=[]
    for i in range(design.timeline.count):
        entity=design.timeline.item(i).entity
        if hasattr(entity,'healthState') and entity.healthState==F.FeatureHealthStates.ErrorFeatureHealthState:failed.append(entity.name)
    if failed:raise RuntimeError('Feature errors: '+str(failed))
    out=os.path.join(root_path,'output');os.makedirs(out,exist_ok=True)
    for name,options in [('EducationCar.f3d',design.exportManager.createFusionArchiveExportOptions(os.path.join(out,'EducationCar.f3d'))),('EducationCar.step',design.exportManager.createSTEPExportOptions(os.path.join(out,'EducationCar.step')))]:
        if not design.exportManager.execute(options):raise RuntimeError('Export failed '+name)
    report={'complete':True,'component_count':len(occurrences),'joints':root.asBuiltJoints.count,'config':config,'parts':reports,'warnings':warnings,'physical_fit_validated':False,'new_parameter_collision_sweep_validated':False}
    with open(os.path.join(out,'fusion-report.json'),'w',encoding='utf-8') as stream:json.dump(report,stream,ensure_ascii=False,indent=2)
    vp=app.activeViewport;vp.fit();vp.refresh();vp.saveAsImageFile(os.path.join(out,'Fusion-preview.png'),1600,1200)
    return report

def run(context):
    app=C.Application.get()
    try:
        build(app);app.userInterface.messageBox('EducationCar built. F3D / STEP / report saved in output/.')
    except Exception:
        error=traceback.format_exc()
        with open(os.path.join(HERE,'fusion-error.txt'),'w',encoding='utf-8') as stream:stream.write(error)
        app.userInterface.messageBox('EducationCar build failed; see fusion-error.txt.\n'+error[-1800:])
