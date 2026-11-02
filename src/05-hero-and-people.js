  // Object-space pattern follows the mesh without changing its silhouette or hand pose.
  gloveMat.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vSuitPosition;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSuitPosition = position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vSuitPosition;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 weave=vec2(vSuitPosition.x*48.0,vSuitPosition.y*44.0+vSuitPosition.z*12.0);
      float fibers=sin(weave.x*3.14159)*sin(weave.y*3.14159);
      vec2 web=vec2(vSuitPosition.x*17.0,vSuitPosition.y*17.0+vSuitPosition.z*4.0);
      float vertical=1.0-smoothstep(.025,.09,abs(fract(web.x+.12*sin(web.y*3.14159))-.5));
      float horizontal=1.0-smoothstep(.025,.09,abs(fract(web.y)-.5));
      float redSuit=smoothstep(-.05,.01,vSuitPosition.y);
      diffuseColor.rgb *= (1.0+fibers*.035)*(1.0-max(vertical,horizontal)*redSuit*.30);
    `);
  };
  function makeHand(side) {
    const group=new THREE.Group(); handsScene.add(group);
    const values=side<0?window.ARM_MODEL.left:window.ARM_MODEL.right;
    const positions=values.slice();
    // Turn each arm around its wrist-to-finger axis without exchanging sides.
    const wrist=new THREE.Vector3(side*.074,-.422,.005);
    const axis=new THREE.Vector3(-side*.383,.518,-.409).normalize();
    const turn=new THREE.Quaternion().setFromAxisAngle(axis,Math.PI),point=new THREE.Vector3();
    const flip=v=>v.sub(wrist).applyQuaternion(turn).add(wrist);
    group.userData.fingertip=flip(new THREE.Vector3(side<0?.29:-.29,.10,-.39));
    group.userData.wingWrist=flip(new THREE.Vector3(side<0?.24:-.24,-.03,-.30));
    group.userData.wingElbow=flip(new THREE.Vector3(side<0?.13:-.13,-.36,-.07));
    const colors=[],sleeveMask=[];
    for(let i=0;i<positions.length;i+=3) {
      const sleeve=values[i+1]<-.02;sleeveMask.push(sleeve); const color=new THREE.Color(sleeve?0x213d66:0xb82b31);
      colors.push(color.r,color.g,color.b);
      flip(point.set(values[i],values[i+1],values[i+2]));
      positions[i]=point.x;positions[i+1]=point.y;positions[i+2]=point.z;
    }
    const geometry=new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3)); geometry.computeVertexNormals();
    group.add(new THREE.Mesh(geometry,gloveMat));
    group.userData.sleeveMask=sleeveMask;group.position.set(side*.47,-.59,-1.0); return group;
  }
  const leftHand=makeHand(-1), rightHand=makeHand(1);
  // Lightweight foreground web wings, spread between the torso and forearms.
  const glideWings=new THREE.Group();handsScene.add(glideWings);glideWings.visible=false;
  const wingFilm=new THREE.MeshBasicMaterial({color:0xb1d6df,transparent:true,opacity:.13,side:THREE.DoubleSide,depthWrite:false});
  const wingThread=new THREE.LineBasicMaterial({color:0xd5f0f4,transparent:true,opacity:.65,depthWrite:false});
  const wingPanels=[];
  for(const side of [-1,1]) {
    const filmGeometry=new THREE.BufferGeometry(),vertices=new Float32Array(14*3),indices=[];
    for(let i=0;i<6;i++){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}
    filmGeometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));filmGeometry.setIndex(indices);
    const lineGeometry=new THREE.BufferGeometry();lineGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(50*3),3));
    const film=new THREE.Mesh(filmGeometry,wingFilm),threads=new THREE.LineSegments(lineGeometry,wingThread);
    film.frustumCulled=threads.frustumCulled=false;glideWings.add(film,threads);wingPanels.push({side,filmGeometry,lineGeometry});
  }
  // Foreground legs only enter the frame as the player lifts their knees in a swing.
  const swingLegs=new THREE.Group();handsScene.add(swingLegs);
  const legSuit=new THREE.MeshStandardMaterial({color:0x213d66,roughness:.72,flatShading:true});
  const bootSuit=new THREE.MeshStandardMaterial({color:0xb82b31,roughness:.72,flatShading:true});
  const boots=[];
  for(const side of [-1,1]) {
    const leg=new THREE.Group();leg.position.x=side*.20;swingLegs.add(leg);
    const shin=new THREE.Mesh(new THREE.CylinderGeometry(.075,.10,.52,7),legSuit);shin.position.set(0,-.16,.10);shin.rotation.x=-.4;leg.add(shin);
    const boot=new THREE.Mesh(new THREE.CylinderGeometry(.075,.08,.22,7),bootSuit);boot.position.set(0,.15,-.03);boot.rotation.x=-.4;leg.add(boot);
    const foot=new THREE.Mesh(new THREE.BoxGeometry(.15,.12,.28),bootSuit);foot.position.set(0,.25,-.16);foot.rotation.x=-.12;leg.add(foot);
    const toe=new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,.15,6),bootSuit);toe.position.set(0,.24,-.30);toe.rotation.z=Math.PI/2;leg.add(toe);
    boots.push(leg);
  }
  // Third-person visuals use a skinned humanoid; first-person remains the fallback while it loads.
  const heroRoot=new THREE.Group();heroRoot.userData.projectile=true;heroRoot.visible=false;scene.add(heroRoot);
  const heroWings=new THREE.Group();heroRoot.add(heroWings);heroWings.visible=false;
  const heroWingMaterial=new THREE.MeshBasicMaterial({color:0xc8edf5,transparent:true,opacity:.35,side:THREE.DoubleSide,depthWrite:false});
  for(const side of [-1,1]) {
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([side*.25,1.35,.04,side*1.15,1.18,.12,side*.28,.83,.15],3));geometry.computeVertexNormals();
    heroWings.add(new THREE.Mesh(geometry,heroWingMaterial));
  }
  const hero={root:heroRoot,wings:heroWings,rigReady:false,rig:null};
  const rigRed={value:new THREE.Color(0xb82b31)},rigBlue={value:new THREE.Color(0x213d66)},rigLogo={value:new THREE.Color(0x11151d)};
  const rigSuitMaterial=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.62,metalness:.04});
  rigSuitMaterial.onBeforeCompile=shader=>{
    shader.uniforms.suitRed=rigRed;shader.uniforms.suitBlue=rigBlue;shader.uniforms.suitLogo=rigLogo;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vSuitRest;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSuitRest = position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vSuitRest;
      uniform vec3 suitRed; uniform vec3 suitBlue; uniform vec3 suitLogo;
      float suitLine(vec2 p,vec2 a,vec2 b,float width){vec2 pa=p-a,ba=b-a;float t=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);return 1.0-smoothstep(width,width*1.8,length(pa-ba*t));}
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 p=vSuitRest;float ax=abs(p.x);
      float head=smoothstep(1.53,1.58,p.y)*(1.0-smoothstep(.22,.32,ax));
      float chest=smoothstep(1.04,1.08,p.y)*(1.0-smoothstep(.20,.29,ax));
      chest=max(chest,smoothstep(1.27,1.32,p.y)*(1.0-smoothstep(.34,.40,ax)));
      float boots=1.0-smoothstep(.39,.43,p.y);
      float gloves=smoothstep(.56,.60,ax)*smoothstep(1.04,1.13,p.y);
      float red=clamp(max(max(head,chest),max(boots,gloves)),0.0,1.0);
      vec3 cloth=mix(suitBlue,suitRed,red);
      float arm=smoothstep(.33,.40,ax)*smoothstep(1.04,1.15,p.y);
      vec2 pattern=mix(vec2(atan(p.x,p.z)*3.2,p.y*21.0),vec2(ax*23.0,atan(p.z,p.y-1.4)*3.2),arm);
      float warp=1.0-smoothstep(.018,.055,abs(fract(pattern.x+.05*sin(pattern.y*3.14159))-.5));
      float weft=1.0-smoothstep(.018,.055,abs(fract(pattern.y)-.5));
      cloth*=1.0-red*max(warp,weft)*.28;
      vec2 emblem=vec2(p.x/.115,(p.y-1.34)/.16);
      float spider=1.0-smoothstep(.8,1.05,length(emblem*vec2(3.4,1.5)));
      spider=max(spider,1.0-smoothstep(.12,.18,length(emblem-vec2(0.0,.63))));
      for(int i=0;i<4;i++){
        float y=.48-float(i)*.29;
        spider=max(spider,suitLine(vec2(abs(emblem.x),emblem.y),vec2(.10,y),vec2(.65,y+.28),.055));
        spider=max(spider,suitLine(vec2(abs(emblem.x),emblem.y),vec2(.65,y+.28),vec2(.92,y-.08),.055));
      }
      float onTorso=smoothstep(.045,.075,abs(p.z))*(1.0-smoothstep(.23,.28,ax))*step(1.08,p.y)*(1.0-step(1.53,p.y));
      cloth=mix(cloth,suitLogo,spider*onTorso*red);
      vec2 lens=vec2((ax-.050)/.038,(p.y-1.706-(ax-.05)*.22)/.026);
      float lensDistance=dot(lens,lens),face=smoothstep(.035,.06,p.z)*head;
      float outline=(1.0-smoothstep(.8,1.1,lensDistance))*face;
      float white=(1.0-smoothstep(.48,.72,lensDistance))*face;
      cloth=mix(cloth,vec3(.006,.009,.014),outline);cloth=mix(cloth,vec3(.88,.94,.96),white);
      diffuseColor.rgb*=cloth;
    `);
  };
  window.installHeroRig=(model,clips)=>{
    if(hero.rigReady)return;
    for(const child of hero.root.children)if(child!==hero.wings)child.visible=false;
    model.rotation.y=Math.PI;hero.root.add(model);
    model.traverse(child=>{
      if(!child.isMesh)return;
      if(child.name==='Eyes'||child.name==='Eyebrows'){child.visible=false;return;}
      child.material=rigSuitMaterial;child.castShadow=true;child.receiveShadow=true;child.frustumCulled=false;
    });
    const mixer=new THREE.AnimationMixer(model),actions={};
    for(const clip of clips)if(['Idle_Loop','Jog_Fwd_Loop','Sprint_Loop','Jump_Loop','Punch_Jab'].includes(clip.name))actions[clip.name]=mixer.clipAction(clip);
    const hand=model.getObjectByName('hand_r')||model.getObjectByName('hand_l'),upperArm=model.getObjectByName('upperarm_r');
    hero.rig={model,mixer,actions,hand,upperArm,current:null};hero.rigReady=true;updateRigPose(0);updateViewCamera(0,0,0,true);
  };
  function updateRigPose(dt) {
    if(!hero.rig)return;
    const rig=hero.rig,speed=Math.hypot(velocity.x,velocity.z),previousName=rig.current?.getClip().name;
    // Keep small speed fluctuations from restarting alternating run cycles.
    const sprinting=speed>(previousName==='Sprint_Loop'?10.8:12.6);
    const jogging=speed>((previousName==='Jog_Fwd_Loop'||previousName==='Sprint_Loop') ? .65 : 1.2);
    const requested=slapAnimation>0?'Punch_Jab':!onGround?'Jump_Loop':sprinting?'Sprint_Loop':jogging?'Jog_Fwd_Loop':'Idle_Loop';
    const action=rig.actions[requested]||rig.actions.Idle_Loop;
    if(action && !rig.current){action.reset().setEffectiveWeight(1).play();rig.current=action;}
    else if(action && rig.current!==action){
      // If a transition is interrupted, keep the existing pose and animation time.
      if(!action.isRunning())action.reset().setEffectiveWeight(0).play();
      rig.current=action;
    }
    if(rig.current && dt>0) {
      const blend=1-Math.exp(-dt/.075);
      for(const active of Object.values(rig.actions))if(active.isRunning()) {
        const target=active===rig.current?1:0,weight=active.getEffectiveWeight();
        const next=weight+(target-weight)*blend;active.setEffectiveWeight(next);
        if(!target && next<.001)active.stop();
      }
    }
    rig.mixer.update(dt);hero.root.updateMatrixWorld(true);
    const anchor=rope?.anchor||(zipTime>0?zipAnchor:null)||(webGrab?webGrab.group.position:null);
    if(anchor && rig.upperArm && rig.hand) {
      const shoulder=rig.upperArm.getWorldPosition(new THREE.Vector3()),hand=rig.hand.getWorldPosition(new THREE.Vector3());
      const from=hand.sub(shoulder),toward=anchor.clone().sub(shoulder);
      if(from.lengthSq()>.001 && toward.lengthSq()>.001) {
        const turn=new THREE.Quaternion().setFromUnitVectors(from.normalize(),toward.normalize());
        const world=rig.upperArm.getWorldQuaternion(new THREE.Quaternion());turn.multiply(world);
        const parent=rig.upperArm.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
        rig.upperArm.quaternion.slerp(parent.multiply(turn),.94);
        hero.root.updateMatrixWorld(true);
      }
    }
  }
  const webLines=[];
  for(let strand=0;strand<3;strand++) {
    const geometry=new THREE.BufferGeometry().setFromPoints(Array.from({length:25},()=>new THREE.Vector3()));
    const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:strand===0?0xffffff:0xb7cdd1,transparent:true,opacity:strand===0?.95:.75}));
    line.visible=false; scene.add(line); webLines.push(line);
  }
  const raycaster=new THREE.Raycaster(); raycaster.far=110;
  function showWeb(visible) { for(const line of webLines) line.visible=visible; }
  const anchorMarker=new THREE.Mesh(new THREE.SphereGeometry(.23,12,8),new THREE.MeshBasicMaterial({color:0xe8fbff}));
  anchorMarker.visible=false;scene.add(anchorMarker);
  const keys={forward:false,back:false,left:false,right:false,sprint:false,swing:false};
  const position=new THREE.Vector3(), velocity=new THREE.Vector3(), previous=new THREE.Vector3();
  const reticle=document.querySelector('.reticle');
  function flashReticle() {
    if(!reticle)return;
    // Restart the pulse even when two hits arrive within one animation.
    reticle.classList.remove('hit');void reticle.offsetWidth;reticle.classList.add('hit');
  }
  if(reticle) reticle.addEventListener('animationend',event=>{
    if(event.animationName==='reticle-hit')reticle.classList.remove('hit');
  });
  let rope=null, webGrab=null, onGround=true, distance=0, elapsed=0, last=0, yaw=0, pitch=0, handBlend=0, swingPose=0, footPose=0, glideBlend=0, glideEngaged=false, cameraRoll=0, feedbackTime=0, playerImpact=0, shockTime=0, attackImmunity=0, runPhase=0, runBlend=0, bombAnimation=0, mapTimer=0;
  let nuke=null,nukeRubble=null,blackout=0,blackoutMode='';
  let wallContact=null,wallRunTime=0,wallCooldown=0,zipTime=0,zipCooldown=0,zipAnchor=null,jumpBuffer=0,coyoteTime=0,dodgeCooldown=0,padCooldown=0;
  let airTrick=null;
  let cameraMode='third',viewDistance=4.4,cameraNear=false;
  const cameraOrigin=new THREE.Vector3(),cameraOffset=new THREE.Vector3(),cameraProbe=new THREE.Vector3();
  try{const saved=localStorage.getItem('spida.camera');if(saved==='first'||saved==='third')cameraMode=saved;}catch(_){}
  const cameraButton=document.getElementById('camera-toggle');
  function updateCameraButton(){if(cameraButton)cameraButton.textContent=`Camera: ${cameraMode==='third'?'Third person':'First person'}`;}
  function setCameraMode(mode) {
    cameraMode=mode==='first'?'first':'third';viewDistance=4.4;
    try{localStorage.setItem('spida.camera',cameraMode);}catch(_){}
    updateCameraButton();updateViewCamera(0,0,0,true);
  }
  function toggleCameraMode(){setCameraMode(cameraMode==='third'?'first':'third');}
  // Keep the chase camera on the player side of nearby walls and roof surfaces.
  function updateViewCamera(dt,bob=0,shake=0,snap=false) {
    hero.root.position.copy(position);hero.root.rotation.y=yaw;
    camera.rotation.set(pitch,yaw,cameraRoll,'YXZ');
    if(cameraMode==='first'||!hero.rigReady) {
      cameraNear=cameraMode==='third';hero.root.visible=false;
      camera.position.set(position.x,position.y+1.7+bob,position.z);
    } else {
      const origin=cameraOrigin.set(position.x,position.y+1.45,position.z);
      const offset=cameraOffset.set(Math.sin(yaw)*Math.cos(pitch)*4.4+Math.cos(yaw)*.72,-Math.sin(pitch)*4.4+.38,Math.cos(yaw)*Math.cos(pitch)*4.4-Math.sin(yaw)*.72);
      let allowed=1;
      for(let i=1;i<=20;i++) {
        const t=i/20,p=cameraProbe.copy(origin).addScaledVector(offset,t),wet=waterAt(p.x,p.z);
        const ground=wet?wet.floor:parkElevation(p.x,p.z);
        if(p.y<ground+.25){allowed=Math.max(.08,(i-1)/20);break;}
        const nearby=playerColliderCells.get(`${Math.floor(p.x/40)},${Math.floor(p.z/40)}`)||[];
        if(nearby.some(b=>p.y<(b.height+.2) && p.y>=(b.bottom||0)-.2 && insideBuilding(p.x,p.z,b,.18))){allowed=Math.max(.08,(i-1)/20);break;}
      }
      const targetDistance=offset.length()*allowed;
      if(snap || targetDistance<viewDistance)viewDistance=targetDistance;
      else viewDistance+=(targetDistance-viewDistance)*(1-Math.exp(-8*dt));
      // A small gap between hide and show distances prevents view flicker beside walls.
      cameraNear=cameraNear?viewDistance<1.55:viewDistance<1.25;hero.root.visible=!cameraNear;
      camera.position.copy(origin).addScaledVector(offset,Math.min(1,viewDistance/offset.length()));
    }
    if(shake){camera.position.x+=(Math.random()-.5)*shake;camera.position.y+=(Math.random()-.5)*shake;camera.position.z+=(Math.random()-.5)*shake;}
    camera.updateMatrixWorld();
  }
  function updateHeroPose(dt) {
    const gliding=glideEngaged&&!rope;
    hero.root.position.copy(position);hero.root.rotation.y=yaw;
    hero.wings.visible=gliding && cameraMode==='third';
    updateRigPose(dt);hero.root.updateMatrixWorld(true);
  }
  updateCameraButton();if(cameraButton)cameraButton.addEventListener('click',toggleCameraMode);
  let recentDanger=null;
  const tethers=[];
  let rescue=null,rescueTimer=30,rescueSequence=0;
  const rescueNotice=document.getElementById('rescue-notice');let rescueNoticeTimer=null;
  function hideRescueNotice() {if(rescueNoticeTimer!==null)clearTimeout(rescueNoticeTimer);rescueNoticeTimer=null;rescueNotice.hidden=true;}
  function showRescueNotice(type) {
    hideRescueNotice();
    rescueNotice.textContent=type==='fall'?'Catch the falling person: hold left click, aim at a surface, and release.':type==='cart'?'Stop the runaway cart.':'Stop the runaway vehicle: web it to a surface or use web bombs.';
    rescueNotice.hidden=false;rescueNoticeTimer=setTimeout(hideRescueNotice,5000);
  }
  const speedBlur=document.getElementById('speed-blur');let speedBlurAmount=0;
  function updateSpeedBlur(speed,dt) {
    const target=THREE.MathUtils.smoothstep(speed,12,55);
    speedBlurAmount+=(target-speedBlurAmount)*(1-Math.exp(-6*dt));
    speedBlur.style.visibility=speedBlurAmount>.01?'visible':'hidden';
    speedBlur.style.opacity=String(speedBlurAmount);
  }
  const nukeButton=document.getElementById('nuke'),blastFlash=document.getElementById('blast-flash'),blastWind=document.getElementById('blast-wind'),blastBlackout=document.getElementById('blast-blackout');
  // ---- Chaos: score, combos, public opinion, popups, voices, particles ----
  let chaosScore=0,comboPoints=0,comboMultiplier=1,comboTimer=0,opinion=50,gravityScale=1;
  let timeScale=1,slowMotion=false,hitStop=0,screenShake=0,slapCooldown=0,slapAnimation=0,slapQueue=0,slapChain=0,slapChainTimer=0,rainTimer=3;
  const mutators={moon:false,bobble:false,raining:false,rocket:false};
  const chaosScoreLabel=document.getElementById('chaos-score'),comboLabel=document.getElementById('chaos-combo'),chaosFeed=document.getElementById('chaos-feed');
  const opinionLabel=document.getElementById('opinion-label'),opinionBar=document.getElementById('opinion-bar'),popupLayer=document.getElementById('popups');
  const pick=list=>list[Math.floor(Math.random()*list.length)];
  const lines={
    hit:['MY SPINE!',"I'm suing!",'Not the face!','Worth it.','I just got out of the hospital!','Is this a bit?!','Call my lawyer!','You absolute MENACE','Do you have insurance?!','Not again...','I felt that in my 401k','THIS IS MY GOOD SHIRT','Why do you smell like the subway?','Free chiropractic!','My Uber was RIGHT there','Tell my wife... actually don\'t','Is this a photo op?!','I pay TAXES','Yelp review incoming','Ow ow ow ow','I was walking to therapy!','Bro what','Rent is $4,000 for THIS?'],
    fly:['WHEEEEE','AAAAAAAAH','I CAN SEE MY APARTMENT','I regret everything','not like this','MOMMY','I CAN FLY?!','this is fine','WORST COMMUTE EVER'],
    land:["I'm okay!",'...I\'m okay','Nothing broken. Probably.','10/10 would fly again','Ow.','I landed in gum','Who\'s paying for this?','Can\'t feel my legs. Cool.','Still better than the L train'],
    saved:['My hero!','You smell weird but thanks','Took you long enough','I would\'ve been fine','Put me down please','Is this sticky stuff... clean?','I\'m posting this'],
    webbed:['Mmmph!','Sticky in a BAD way','Oh, come ON','I\'m late for work!','This is assault','Is this... organic?','Unhand me, bug boy'],
    greet:['Hey it\'s Spider-Man!','Pay your rent, Peter!','Do a flip!','Are those pajamas?','My kid loves you. I don\'t.','Please don\'t.','Oh no. Not him.','Sign my cast? You broke it.','You owe me a hot dog','Menace!!'],
    panic:['RUN!!!','IS THAT A NUKE?!','I LEFT THE STOVE ON','NOT TODAY','I DIDN\'T EVEN GET BRUNCH','WHY IS IT ALWAYS NEW YORK','THIS IS NOT IN MY LEASE','MOMMY!!','SPIDER-MAN WHAT DID YOU DO','worth it','MY DEPOSIT!','EVERY MAN FOR HIMSELF'],
    revive:['...I\'m okay!','I\'M FINE','Walk it off, Gary','Cartoon physics, baby','Back from the dead, still late']
  };
  const opinionTiers=[[0,'PUBLIC ENEMY #1'],[15,'MENACE'],[30,'NUISANCE'],[45,'MID'],[60,'FRIENDLY-ISH'],[75,'NEIGHBORHOOD HERO'],[90,'LITERAL ANGEL']];
  // The opinion panel stays compact and expands briefly when its details change.
  const opinionPanel=document.querySelector('.opinion');let detailTimer=null;
  function flashDetails() {
    if(!opinionPanel)return;
    opinionPanel.classList.add('expanded');clearTimeout(detailTimer);detailTimer=setTimeout(()=>opinionPanel.classList.remove('expanded'),5000);
  }
  function adjustOpinion(amount) {
    opinion=THREE.MathUtils.clamp(opinion+amount,0,100);
    let tier=opinionTiers[0][1];for(const [threshold,name] of opinionTiers)if(opinion>=threshold)tier=name;
    if(opinionLabel && opinionLabel.textContent!==tier)flashDetails();
    if(opinionLabel){opinionLabel.textContent=tier;opinionBar.style.width=`${opinion}%`;opinionBar.style.background=opinion<30?'#ff5b4f':opinion<60?'#ffc75e':'#6ff09a';}
  }
