  // The title screen slowly circles the skyline until the player starts.
  const titleScreen=document.getElementById('title'),titlePlay=document.getElementById('title-play'),titleNew=document.getElementById('title-new');
  const skipTitle=new URLSearchParams(location.search).has('test')||new URLSearchParams(location.search).has('debug');
  let titleOpen=!skipTitle,titleTime=0;
  if(skipTitle)titleScreen.hidden=true;else document.querySelector('.game-shell').classList.add('title-open');
  function drawTitle(raw) {
    titleTime+=raw;const angle=titleTime*.04;
    camera.position.set(position.x+Math.cos(angle)*190,110,position.z+180+Math.sin(angle)*190);camera.lookAt(position.x+30,35,position.z+260);
    sky.position.copy(camera.position);updateLandmarks(raw);renderer.clear();renderer.render(scene,camera);
  }
  function startGame() {
    if(!titleOpen)return;
    titleOpen=false;titleScreen.classList.add('leaving');document.querySelector('.game-shell').classList.remove('title-open');setTimeout(()=>{titleScreen.hidden=true;},460);
    unlockSound();canvas.focus({preventScroll:true});
    if(!matchMedia('(pointer: coarse)').matches && canvas.requestPointerLock){const request=canvas.requestPointerLock();if(request?.catch)request.catch(()=>{});}
    last=performance.now();
  }
  function showTitleReady() {
    if(!titleOpen)return;
    let saved=false;try{saved=Object.keys(localStorage).some(key=>key.startsWith('spida.') && !['spida.camera','spida.graphics','spida.hints','spida.hud'].includes(key));}catch(_){/* No storage, no saved game. */}
    titlePlay.textContent=saved?'Continue':'Play';titleNew.hidden=!saved;titleScreen.classList.remove('loading');titlePlay.focus();
  }
  titlePlay.addEventListener('click',startGame);
  titleNew.addEventListener('click',()=>{
    // Starting over asks once more before erasing saved progress.
    if(!titleNew.classList.contains('confirm')){titleNew.classList.add('confirm');titleNew.textContent='Erase progress and start over?';return;}
    try{for(const key of Object.keys(localStorage))if(key.startsWith('spida.') && !['spida.camera','spida.graphics','spida.hud'].includes(key))localStorage.removeItem(key);}catch(_){/* Nothing to erase. */}
    location.reload();
  });
  // ---- Photo mode: frozen time, a free camera, filters and saved snapshots ----
  const photoFilters=[['Natural','none'],['Noir','grayscale(1) contrast(1.25)'],['Golden hour','sepia(.35) saturate(1.35) brightness(1.05)'],['Comic','saturate(1.8) contrast(1.35)']];
  const photoBar=document.getElementById('photo-bar');
  let photoMode=null;
  function togglePhotoMode() {
    const shellElement=document.querySelector('.game-shell');
    if(photoMode) {
      yaw=photoMode.yaw;pitch=photoMode.pitch;canvas.style.filter='';shellElement.classList.remove('photo');photoMode=null;last=performance.now();return;
    }
    photoMode={camera:camera.position.clone(),yaw,pitch,filter:0,move:{}};shellElement.classList.add('photo');updatePhotoBar();
  }
  function updatePhotoBar(){if(photoBar)photoBar.textContent=`Photo mode • WASD fly, Space/Ctrl up/down • 1-4 filter: ${photoFilters[photoMode.filter][0]} • Enter save • P exit`;}
  function drawPhoto(raw) {
    const move=photoMode.move,forward=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)),right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
    const speed=(move.fast?30:10)*raw;
    if(move.forward)camera.position.addScaledVector(forward,speed);if(move.back)camera.position.addScaledVector(forward,-speed);
    if(move.right)camera.position.addScaledVector(right,speed);if(move.left)camera.position.addScaledVector(right,-speed);
    if(move.up)camera.position.y+=speed;if(move.down)camera.position.y-=speed;
    camera.rotation.set(pitch,yaw,0,'YXZ');sky.position.copy(camera.position);renderer.clear();renderer.render(scene,camera);
  }
  function savePhoto() {
    renderer.clear();renderer.render(scene,camera);
    // Bake the chosen filter into the saved image.
    const out=document.createElement('canvas');out.width=canvas.width;out.height=canvas.height;const context=out.getContext('2d');
    context.filter=photoFilters[photoMode.filter][1];context.drawImage(canvas,0,0);
    sellPhoto();
    out.toBlob(blob=>{if(!blob)return;const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`skyline-swing-${Date.now()}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),2000);});
    playEffect('success');
  }
  function photoKey(e,down) {
    const move=photoMode.move,map={KeyW:'forward',KeyS:'back',KeyA:'left',KeyD:'right',Space:'up',ControlLeft:'down',ShiftLeft:'fast'};
    if(map[e.code]){move[map[e.code]]=down;e.preventDefault();return;}
    if(!down)return;
    if(/^Digit[1-4]$/.test(e.code)){photoMode.filter=+e.code.slice(5)-1;canvas.style.filter=photoFilters[photoMode.filter][1];updatePhotoBar();}
    else if(e.code==='Enter')savePhoto();
    else if(remapKey(e.code)==='KeyP'||e.code==='Escape'){e.preventDefault();togglePhotoMode();}
  }
  function frame(t) { const raw=Math.min((t-last)/1000||0,.033); last=t;if(titleOpen){drawTitle(raw);requestAnimationFrame(frame);return;}if(photoMode){drawPhoto(raw);requestAnimationFrame(frame);return;}if(paused){requestAnimationFrame(frame);return;} timeScale+=((slowMotion||dodgeSlow>0?.3:1)-timeScale)*(1-Math.exp(-10*raw));let dt=raw*timeScale;if(hitStop>0){hitStop-=raw;dt*=.06;} update(dt);drawFrame(dt);requestAnimationFrame(frame); }
  const map={KeyW:'forward',ArrowUp:'forward',KeyS:'back',ArrowDown:'back',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
  window.addEventListener('keydown',e=>{ const code=remapKey(e.code); if(photoMode){photoKey(e,true);return;} if(code==='KeyP'&&!e.repeat&&!titleOpen&&!paused){togglePhotoMode();return;} if(uiOpen){if(e.code==='Escape'){e.preventDefault();if(!document.getElementById('shop').hidden)closeShop();else closeTravel();}else if(!document.getElementById('shop').hidden && /^Digit[1-9]$/.test(e.code)){document.querySelectorAll('#shop-list button')[+e.code.slice(5)-1]?.click();}else if(/^Digit[1-9]$/.test(e.code))document.querySelectorAll('#travel-list button')[+e.code.slice(5)-1]?.click();return;} if(code==='KeyG'&&!e.repeat&&!titleOpen&&!paused){interact();} if(e.code==='Tab'){e.preventDefault();opinionPanel?.classList.add('held');return;} if(titleOpen){if(e.code==='Enter'){e.preventDefault();startGame();}return;} if(e.code==='Escape'){e.preventDefault();if(!e.repeat && !(paused && performance.now()-pointerUnlockTime<300))setPaused(!paused);return;} if(paused)return; if (map[e.code]) { e.preventDefault(); keys[map[e.code]]=true; } if(code==='KeyR'&&!e.repeat)reset(); if(code==='KeyV'&&!e.repeat)toggleCameraMode(); if(code==='KeyE'&&!e.repeat)webZip(); if(code==='KeyC'&&!e.repeat)dodge(); if(code==='KeyN'&&!e.repeat)launchNuke(); if((code==='KeyF'||code==='KeyQ')&&!e.repeat)spiderSlap(); if(code==='KeyT'){slowMotion=true;document.querySelector('.game-shell').classList.add('slowmo');} if(e.code==='Space'){e.preventDefault();if(!e.repeat)jump();} if(e.code==='ShiftLeft'||e.code==='ShiftRight'){e.preventDefault();keys.sprint=true;} });
  window.addEventListener('keyup',e=>{ const code=remapKey(e.code); if(photoMode){photoKey(e,false);return;} if(e.code==='Tab')opinionPanel?.classList.remove('held'); if(map[e.code])keys[map[e.code]]=false; if(e.code==='ShiftLeft'||e.code==='ShiftRight')keys.sprint=false; if(code==='KeyT'){slowMotion=false;document.querySelector('.game-shell').classList.remove('slowmo');} });
  window.addEventListener('blur',()=>{ Object.keys(keys).forEach(k=>keys[k]=false); cancelWebGrab();swing(false); });
  canvas.addEventListener('pointerdown',e=>{
    if(paused)return;
    e.preventDefault();
    if (e.pointerType==='mouse') {
      const locked=document.pointerLockElement===canvas;
      const rect=canvas.getBoundingClientRect();
      const x=locked?0:(e.clientX-rect.left)/rect.width*2-1, y=locked?0:1-(e.clientY-rect.top)/rect.height*2;
      if(e.button===0) beginWebAction(x,y); else if(e.button===2) fireBomb(x,y); else if(e.button===1) spiderSlap();
      if (!locked && canvas.requestPointerLock) {
        try {const request=canvas.requestPointerLock();if(request?.catch)request.catch(()=>{});} catch(_) {/* Pointer lock can be unavailable in embedded previews. */}
      }
    }
    else { canvas.setPointerCapture(e.pointerId); }
  });
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('pointerup',e=>{if(!paused && e.pointerType==='mouse' && e.button===0){const locked=document.pointerLockElement===canvas,rect=canvas.getBoundingClientRect();endWebAction(locked?0:(e.clientX-rect.left)/rect.width*2-1,locked?0:1-(e.clientY-rect.top)/rect.height*2);}});
  document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas) { yaw-=e.movementX*.0025*settings.sensitivity; pitch=THREE.MathUtils.clamp(pitch-e.movementY*.0025*settings.sensitivity*(settings.invert?-1:1),-1.35,1.35); }});
  let touchX=0,touchY=0;
  canvas.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'){touchX=e.clientX;touchY=e.clientY;}});
  canvas.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse' && e.buttons){yaw-=(e.clientX-touchX)*.005*settings.sensitivity;pitch=THREE.MathUtils.clamp(pitch-(e.clientY-touchY)*.005*settings.sensitivity*(settings.invert?-1:1),-1.35,1.35);touchX=e.clientX;touchY=e.clientY;}});
  document.addEventListener('pointerlockchange',()=>{const locked=document.pointerLockElement===canvas;if(!locked && pointerWasLocked && !paused && !uiOpen){pointerUnlockTime=performance.now();setPaused(true,true);}pointerWasLocked=locked;if(!locked && !paused){cancelWebGrab();swing(false);}});
  for (const id of ['forward','back','left','right','sprint','jump','swing','bomb','zip','slap','dodge']) {
    const button=document.getElementById(id);
    button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();button.setPointerCapture(e.pointerId);if(id==='jump')jump();else if(id==='swing')beginWebAction();else if(id==='bomb')fireBomb();else if(id==='zip')webZip();else if(id==='slap')spiderSlap();else if(id==='dodge')dodge();else keys[id]=true;});
    const release=e=>{e.stopPropagation();if(id==='swing'){if(e.type==='pointerup')endWebAction();else{cancelWebGrab();swing(false);}}else if(id!=='jump' && id!=='bomb' && id!=='zip' && id!=='slap' && id!=='dodge')keys[id]=false;};
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  }
  document.getElementById('camera-view').addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();toggleCameraMode();});
  nukeButton.addEventListener('pointerdown',event=>event.stopPropagation());
  nukeButton.addEventListener('click',event=>{event.stopPropagation();if(!paused)launchNuke();});
  resumeButton.addEventListener('click',()=>setPaused(false));
  window.addEventListener('resize',()=>{particleMaterial.uniforms.viewport.value=innerHeight*renderer.getPixelRatio();camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();handsCamera.aspect=camera.aspect;handsCamera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
  // Batch the static details added after the buildings were constructed too.
  batchBuildingDetails();
  // Keep distant actors interactive while rendering a low-cost silhouette.
  // Their existing child pivots remain intact inside an identity transform.
  const hiddenDetailMatrix=new THREE.Matrix4().makeTranslation(0,-10000,0);
  const actorDetailGeometry=new THREE.CylinderGeometry(.32,.38,1,6),vehicleDetailGeometry=new THREE.BoxGeometry(1,1,1);
  const detailActors=[...cars,...pedestrians];
  // Far actors are drawn as one instanced stand-in per kind, tinted to match.
  const personProxies=new THREE.InstancedMesh(actorDetailGeometry,new THREE.MeshLambertMaterial({color:0xffffff}),pedestrians.length);
  const carProxies=new THREE.InstancedMesh(vehicleDetailGeometry,new THREE.MeshLambertMaterial({color:0xffffff}),cars.length);
  const proxyLocal=new THREE.Matrix4(),proxyWorld=new THREE.Matrix4(),proxyColor=new THREE.Color();
  for(const batch of [personProxies,carProxies]){batch.frustumCulled=false;batch.raycast=()=>{};batch.userData.projectile=true;batch.castShadow=false;scene.add(batch);}
  for(const actor of detailActors) {
    const root=new THREE.Group();while(actor.group.children.length)root.add(actor.group.children[0]);actor.group.add(root);actor.visualRoot=root;
    const car=cars.includes(actor),batch=car?carProxies:personProxies,index=car?cars.indexOf(actor):pedestrians.indexOf(actor);
    actor.proxyBatch=batch;actor.proxyIndex=index;actor.proxyLocal=new THREE.Matrix4().compose(new THREE.Vector3(0,actor.top*.43,0),new THREE.Quaternion(),new THREE.Vector3(car?actor.hx*2:1,actor.top*.85,car?actor.hz*2:1));
    batch.setColorAt(index,car?proxyColor.setHex(actor.modelKind==='taxi'?0xd5a536:0x697077):proxyColor.copy(actor.proxyColor||new THREE.Color(0x646b70)).lerp(new THREE.Color(0x8a8f94),.25));
    batch.setMatrixAt(index,hiddenDetailMatrix);
  }
  personProxies.instanceColor.needsUpdate=carProxies.instanceColor.needsUpdate=true;
  const detailTrees=scene.children.filter(object=>object.userData.treeType).map(group=>{
    const trunk=group.children.find(child=>child.isMesh && child.geometry.type==='CylinderGeometry');
    const height=trunk?.geometry.parameters.height||5;
    const root=new THREE.Group();while(group.children.length)root.add(group.children[0]);group.add(root);return {group,root,height};
  });
  const distantTrunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.18,.24,1,6),bark,detailTrees.length);
  const distantCanopies=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),parkLeaves[1],detailTrees.length);
  for(const batch of [distantTrunks,distantCanopies]){batch.frustumCulled=false;batch.userData.projectile=true;batch.raycast=()=>{};scene.add(batch);}
  const detailTransform=new THREE.Object3D(),detailMatrix=new THREE.Matrix4(),hiddenDetail=new THREE.Matrix4().makeTranslation(0,-10000,0);
  let sceneDetailFrame=0;
  function updateSceneDetail(force=false) {
    // Far stand-ins barely move on screen, so refresh them every third frame.
    if(!force && sceneDetailFrame++%3)return;
    for(const actor of detailActors) {
      const p=actor.group.position,dx=p.x-position.x,dz=p.z-position.z,dy=(p.y-position.y)*.5;
      const distanceSq=dx*dx+dz*dz+dy*dy;
      const detailed=distanceSq<((cars.includes(actor)?85:60)*graphicsProfiles[graphicsQuality].detail)**2 || actor.webHeld || actor.webPinned || actor.webTether || actor.stuck || actor.knockback || rescue?.actor===actor;
      if(detailed!==actor.detailShown) {
        // Detach far bodies entirely so the scene graph skips their limbs each frame.
        actor.detailShown=detailed;if(detailed)actor.group.add(actor.visualRoot);else actor.visualRoot.removeFromParent();
      }
      if(detailed) {
        const shadow=distanceSq<(45*graphicsProfiles[graphicsQuality].detail)**2 || Boolean(actor.knockback);
        if(shadow!==actor.detailShadow) {
          if(!actor.shadowParts){actor.shadowParts=[];actor.visualRoot.traverse(child=>{if(child.isMesh&&child.castShadow)actor.shadowParts.push(child);});}
          for(const part of actor.shadowParts)part.castShadow=shadow;
          actor.detailShadow=shadow;
        }
      }
      if(!detailed && actor.group.visible){actor.group.updateMatrix();proxyWorld.multiplyMatrices(actor.group.matrix,actor.proxyLocal);actor.proxyBatch.setMatrixAt(actor.proxyIndex,proxyWorld);}
      else actor.proxyBatch.setMatrixAt(actor.proxyIndex,hiddenDetailMatrix);
    }
    personProxies.instanceMatrix.needsUpdate=carProxies.instanceMatrix.needsUpdate=true;
    detailTrees.forEach((tree,index)=>{
      const p=tree.group.position,dx=p.x-position.x,dz=p.z-position.z;
      const distanceSq=dx*dx+dz*dz,detailRadius=75*graphicsProfiles[graphicsQuality].detail;tree.root.visible=distanceSq<detailRadius*detailRadius;
      if(distanceSq>=detailRadius*detailRadius && distanceSq<240*240) {
        tree.group.updateMatrix();
        detailTransform.position.set(0,tree.height*.5,0);detailTransform.scale.set(1,tree.height,1);detailTransform.updateMatrix();
        detailMatrix.multiplyMatrices(tree.group.matrix,detailTransform.matrix);distantTrunks.setMatrixAt(index,detailMatrix);
        detailTransform.position.set(0,tree.height+.5,0);detailTransform.scale.set(1.6,1.9,1.6);detailTransform.updateMatrix();
        detailMatrix.multiplyMatrices(tree.group.matrix,detailTransform.matrix);distantCanopies.setMatrixAt(index,detailMatrix);
      } else {distantTrunks.setMatrixAt(index,hiddenDetail);distantCanopies.setMatrixAt(index,hiddenDetail);}
    });
    distantTrunks.instanceMatrix.needsUpdate=true;distantCanopies.instanceMatrix.needsUpdate=true;
  }
  // ---- Things to do: golden pizza, ring races and hydrant geysers ----
  const activityHud=document.getElementById('activity'),raceHud=document.getElementById('race-hud');
  scene.updateMatrixWorld(true);
  // Golden pizza slices hide on rooftops across both boroughs and on the big landmarks.
  const pizzaSpots=[[-145.8,82,1215],[60,198,300],[140,152,260],[286,46,bridgeZ],[342,46,bridgeZ],[560,27,1084],[60,56,220],[20,13.6,530],[20,3,925],[-180,177,700],[-140,174,700],[20,55,460]].map(([x,y,z])=>new THREE.Vector3(x,y,z));
  {
    const candidates=buildings.filter(b=>!b.destroyed && !b.landmark && b.height>8).sort((a,b)=>random(a.x*3.1+b.z)-random(b.x*3.1+a.z));
    const down=new THREE.Vector3(0,-1,0);
    for(const b of candidates) {
      if(pizzaSpots.length>=40)break;
      if(pizzaSpots.some(p=>Math.hypot(p.x-b.x,p.z-b.z)<70))continue;
      raycaster.set(new THREE.Vector3(b.x,400,b.z),down);raycaster.far=420;
      const hit=raycaster.intersectObjects(grappleMeshes,false)[0];
      if(hit)pizzaSpots.push(hit.point.clone().setY(hit.point.y+1.4));
    }
    raycaster.far=150;
  }
  const pizzaGeometry=(()=>{const geometry=new THREE.CylinderGeometry(1,1,.22,3);geometry.scale(.75,1,1.1);return geometry;})();
  const pizzaMaterial=new THREE.MeshStandardMaterial({color:0xffc83a,emissive:0xff9a1a,emissiveIntensity:.7,metalness:.6,roughness:.3});
  const pizzas=new THREE.InstancedMesh(pizzaGeometry,pizzaMaterial,pizzaSpots.length);pizzas.frustumCulled=false;pizzas.userData.projectile=true;pizzas.raycast=()=>{};scene.add(pizzas);
  let pizzaCollected=new Set();
  try{pizzaCollected=new Set(JSON.parse(localStorage.getItem('spida.pizza')||'[]'));}catch(_){/* Fall back to a fresh hunt. */}
  const pizzaTransform=new THREE.Object3D();
  function updatePizza(dt) {
    pizzaSpots.forEach((spot,i)=>{
      if(pizzaCollected.has(i)){pizzas.setMatrixAt(i,hiddenPizza);return;}
      pizzaTransform.position.copy(spot);pizzaTransform.position.y+=Math.sin(elapsed*2+i)*.25;pizzaTransform.rotation.set(Math.PI/2*.3,elapsed*2+i,0);pizzaTransform.scale.setScalar(1.3);
      pizzaTransform.updateMatrix();pizzas.setMatrixAt(i,pizzaTransform.matrix);
      if(spot.distanceToSquared(position.clone().setY(position.y+1))<2.6*2.6) {
        pizzaCollected.add(i);try{localStorage.setItem('spida.pizza',JSON.stringify([...pizzaCollected]));}catch(_){/* Session only. */}
        playEffect('success');burst(spot,40,[0xffc83a,0xff5a36,0xffffff],{speed:8,up:5,life:1,size:.35});
        gainBucks(25);awardChaos(500,`GOLDEN PIZZA ${pizzaCollected.size}/${pizzaSpots.length}`,spot.clone(),'hero');
        worldPopup(pick(['Still warm?!','Pigeon-tested','Rooftop pizza hits different','Only slightly radioactive','Worth the climb','Grease = power']),spot.clone().setY(spot.y+1),'speech',2);
        if(pizzaCollected.size===pizzaSpots.length)showBreaking('ALL 40 PIZZAS FOUND');
        updateActivityHud();
      }
    });
    pizzas.instanceMatrix.needsUpdate=true;
  }
  const hiddenPizza=new THREE.Matrix4().makeTranslation(0,-1e4,0);
  // Ring races: fly through each ring in order against the clock.
  const raceCourses=[
    {name:'MIDTOWN MADNESS',par:[22,30,40],start:[80,3,470],rings:[[80,22,430],[80,32,390],[80,40,350],[80,30,310],[60,26,280],[20,22,280],[-20,30,280],[-60,36,280],[-80,26,240],[-80,20,200]]},
    {name:'BRIDGE RUN',par:[18,25,34],start:[200,3,740],rings:[[232,20,760],[266,28,760],[300,34,760],[330,26,760],[362,30,760],[400,22,760],[440,18,740],[480,24,710],[520,18,680]]},
    {name:'HARLEM HUSTLE',par:[24,32,44],start:[-40,3,-250],rings:[[-40,14,-300],[-40,20,-350],[-40,14,-400],[-40,24,-450],[-40,16,-500],[-40,24,-550],[0,18,-600],[40,26,-600],[80,18,-600],[120,22,-560]]},
    {name:'CONEY COASTER',par:[16,22,30],start:[380,3,1040],rings:[[420,8,1066],[460,18,1070],[500,10,1074],[560,27,1084],[600,12,1074],[640,22,1070],[680,8,1066],[720,16,1070]]}
  ].map(course=>({...course,start:new THREE.Vector3(...course.start),rings:course.rings.map(r=>new THREE.Vector3(...r))}));
  const ringGeometry=new THREE.TorusGeometry(4.2,.32,10,40);
  const startRingMaterial=new THREE.MeshBasicMaterial({color:0x6fe3ff,transparent:true,opacity:.75,toneMapped:false});
  const activeRingMaterial=new THREE.MeshBasicMaterial({color:0xffd25e,toneMapped:false}),nextRingMaterial=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.35,toneMapped:false});
  for(const course of raceCourses) {
    const ring=new THREE.Mesh(ringGeometry,startRingMaterial);ring.position.copy(course.start).setY(4.6);ring.lookAt(course.rings[0].x,4.6,course.rings[0].z);
    ring.userData.projectile=true;ring.raycast=()=>{};scene.add(ring);course.marker=ring;
    try{course.best=Number(localStorage.getItem(`spida.race.${course.name}`))||null;}catch(_){course.best=null;}
  }
  const raceRing=new THREE.Mesh(ringGeometry,activeRingMaterial),raceNext=new THREE.Mesh(ringGeometry,nextRingMaterial);
  for(const ring of [raceRing,raceNext]){ring.visible=false;ring.userData.projectile=true;ring.raycast=()=>{};scene.add(ring);}
  let race=null,raceCooldown=0;
  function placeRaceRings() {
    const current=race.course.rings[race.index],next=race.course.rings[race.index+1];
    raceRing.position.copy(current);raceRing.lookAt(next||current.clone().add(current.clone().sub(race.course.rings[race.index-1]||race.course.start)));raceRing.visible=true;
    raceNext.visible=Boolean(next);if(next){raceNext.position.copy(next);raceNext.lookAt(race.course.rings[race.index+2]||next.clone().add(next.clone().sub(current)));}
  }
  function updateRaces(dt) {
    raceCooldown=Math.max(0,raceCooldown-dt);
    const body=position.clone().setY(position.y+1);
    for(const course of raceCourses) {
      course.marker.rotation.z+=dt*.8;course.marker.scale.setScalar(1+.06*Math.sin(elapsed*4));course.marker.visible=!race;
      if(!race && !raceCooldown && course.marker.position.distanceTo(body)<4.6) {
        race={course,index:0,time:0};placeRaceRings();playEffect('alert');showBreaking(`RACE: ${course.name}. GOLD UNDER ${course.par[0]}s.`);
      }
    }
    if(!race){if(raceHud)raceHud.hidden=true;return;}
    race.time+=dt;
    raceRing.rotation.z+=dt*1.5;raceRing.scale.setScalar(1+.05*Math.sin(elapsed*8));
    if(raceRing.position.distanceTo(body)<4.8) {
      playEffect('zip');burst(raceRing.position,24,[0xffd25e,0xffffff],{speed:10,life:.5,size:.3});race.index++;
      if(race.index>=race.course.rings.length) {
        const time=race.time,[gold,silver,bronze]=race.course.par,medal=time<=gold?'GOLD':time<=silver?'SILVER':time<=bronze?'BRONZE':'PARTICIPATION';
        const record=!race.course.best || time<race.course.best;if(record){race.course.best=time;try{localStorage.setItem(`spida.race.${race.course.name}`,String(time));}catch(_){/* Session only. */}}
        gainBucks(medal==='GOLD'?150:medal==='SILVER'?100:medal==='BRONZE'?60:10);awardChaos(medal==='GOLD'?3000:medal==='SILVER'?2000:medal==='BRONZE'?1200:300,`${medal} ${time.toFixed(1)}s`,raceRing.position.clone(),'hero');
        showBreaking(`${race.course.name}: ${time.toFixed(2)}s, ${medal}${record?' (NEW RECORD)':''}`);
        burst(raceRing.position,80,confetti,{speed:14,up:8,life:1.8,size:.35});playEffect('success');
        raceRing.visible=raceNext.visible=false;race=null;raceCooldown=4;updateActivityHud();return;
      }
      placeRaceRings();
    }
    if(race.time>120 || keys.back && keys.forward){raceRing.visible=raceNext.visible=false;race=null;raceCooldown=3;showBreaking('RACE ABANDONED');return;}
    if(raceHud){raceHud.hidden=false;raceHud.textContent=`${race.course.name}  ${race.time.toFixed(1)}s  •  RING ${race.index+1}/${race.course.rings.length}`;}
  }
  // Fire hydrants: slap or tackle one and it erupts into a launch-pad geyser.
  const geysers=[];
  function burstHydrant(hydrant) {
    if(hydrant.userData.geyser>0)return;
    hydrant.userData.geyser=6;geysers.push(hydrant);playEffect('splat',hydrant.position);
    awardChaos(150,pick(['HYDRANT HAVOC','FREE SHOWER','CITY WATER BILL +$40K']),hydrant.position.clone().setY(2.5));
  }
  function updateGeysers(dt) {
    for(const hydrant of hydrants) {
      if(hydrant.userData.geyser>0)continue;
      const dx=hydrant.position.x-position.x,dz=hydrant.position.z-position.z;
      if(dx*dx+dz*dz<1.3 && position.y<1.6 && Math.hypot(velocity.x,velocity.z)>8)burstHydrant(hydrant);
    }
    for(let i=geysers.length-1;i>=0;i--) {
      const hydrant=geysers[i],p=hydrant.position;hydrant.userData.geyser-=dt;
      if(hydrant.userData.geyser<=0){geysers.splice(i,1);continue;}
      const top=p.clone().setY(p.y+.7);
      burst(top,3,[0xd8f4ff,0x9fd8f0,0xffffff],{speed:3,up:22,life:1.1,gravity:16,size:.45,drag:.4,spread:.3});
      if(Math.hypot(position.x-p.x,position.z-p.z)<1.6 && position.y<14){velocity.y=Math.max(velocity.y,26);onGround=false;if(!hydrant.userData.launched){hydrant.userData.launched=true;awardChaos(200,'GEYSER LAUNCH',null,'trick');}}
      for(const npc of pedestrians) {
        const q=npc.group.position;
        if(!npc.knockback && !npc.dead && Math.abs(q.x-p.x)<1.6 && Math.abs(q.z-p.z)<1.6){throwActor(npc,null,false,new THREE.Vector3((Math.random()-.5)*4,24,(Math.random()-.5)*4));say(npc,'fly');}
      }
    }
  }
  function updateActivityHud() {
    flashDetails();
    if(!activityHud)return;
    const medals=raceCourses.filter(c=>c.best && c.best<=c.par[0]).length;
    activityHud.innerHTML=`<span>🍕 ${pizzaCollected.size}/${pizzaSpots.length}</span><span>🏁 GOLD ${medals}/${raceCourses.length}</span>`;
  }
  updateActivityHud();
  // Manhole steam, because it is not New York without it.
  const steamVents=[],manholeMat=material(0x2a2e31),manholeGeometry=new THREE.CircleGeometry(.55,16);
  for(let i=-5;i<=5;i++)for(let j=-16;j<=22;j++) {
    if(random(i*61+j*17+5)>.16 || i===-1 || i===0 && j>-6 && j<5)continue;
    const vent=new THREE.Mesh(manholeGeometry,manholeMat);vent.rotation.x=-Math.PI/2;vent.position.set(i*40-1.5,.03,j*40+20);scene.add(vent);steamVents.push(vent.position);
  }
  let steamTimer=0;
  function updateSteam(dt) {
    steamTimer-=dt;if(steamTimer>0)return;steamTimer=.16;
    for(const vent of steamVents)if(Math.abs(vent.x-position.x)<110 && Math.abs(vent.z-position.z)<110)
      burst(vent,1,[0xeef0f2,0xd8dcdf],{speed:.35,up:1.7,gravity:-.3,life:1.8,size:.9,drag:.8,spread:.4,opacity:.22});
  }
  function updateActivities(dt){updatePizza(dt);updateRaces(dt);updateGeysers(dt);updateSteam(dt);updateGalleries(dt);}
  // ---- Time of day and weather ----
  const clockHud=document.getElementById('clock');
  let dayHour=17,nightAmount=0,duskAmount=0,weather='clear',weatherTarget='clear',weatherTimer=150,overcast=0,precipitation=0;
  const sunDir=new THREE.Vector3(-.48,.8,.32),dayFog=new THREE.Color(0xb6c9d0),duskFog=new THREE.Color(0xd8a68a),nightFog=new THREE.Color(0x0c1320),rainFog=new THREE.Color(0x8b969c),snowFog=new THREE.Color(0xc9d3da),fogColor=new THREE.Color();
  const daySun=new THREE.Color(0xffe3c4),duskSun=new THREE.Color(0xff9a5c),moonLight=new THREE.Color(0x8ea8d8);
  // Street lamps glow after dark, with a soft pool of light on the pavement.
  const glowTexture=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,240,200,1)');r.addColorStop(.4,'rgba(255,214,150,.45)');r.addColorStop(1,'rgba(255,200,130,0)');g.fillStyle=r;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);})();
  const lampGlowPositions=new Float32Array(streetLamps.length*3);
  streetLamps.forEach((lamp,i)=>{lampGlowPositions.set([lamp.position.x-1.1,lamp.position.y+4.85,lamp.position.z],i*3);});
  const lampGlowGeometry=new THREE.BufferGeometry();lampGlowGeometry.setAttribute('position',new THREE.BufferAttribute(lampGlowPositions,3));
  const lampGlow=new THREE.Points(lampGlowGeometry,new THREE.PointsMaterial({map:glowTexture,size:3.2,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,color:0xffe2b0}));
  const lampPools=new THREE.InstancedMesh(new THREE.PlaneGeometry(9,9),new THREE.MeshBasicMaterial({map:glowTexture,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}),streetLamps.length);
  {const transform=new THREE.Object3D();streetLamps.forEach((lamp,i)=>{transform.position.set(lamp.position.x-1.1,.5,lamp.position.z);transform.rotation.set(-Math.PI/2,0,0);transform.updateMatrix();lampPools.setMatrixAt(i,transform.matrix);});}
  for(const object of [lampGlow,lampPools]){object.frustumCulled=false;object.userData.projectile=true;object.raycast=()=>{};object.visible=false;scene.add(object);}
  // Rain streaks and snowflakes follow the camera in a box.
  const dropCount=2400,rainPositions=new Float32Array(dropCount*6),snowPositions=new Float32Array(dropCount*3),dropSeeds=new Float32Array(dropCount*3);
  for(let i=0;i<dropCount;i++){dropSeeds[i*3]=Math.random()*70-35;dropSeeds[i*3+1]=Math.random()*40;dropSeeds[i*3+2]=Math.random()*70-35;}
  const rainGeometry=new THREE.BufferGeometry();rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
  const rain=new THREE.LineSegments(rainGeometry,new THREE.LineBasicMaterial({color:0xc4d2dc,transparent:true,opacity:.55,depthWrite:false}));
  const snowGeometry=new THREE.BufferGeometry();snowGeometry.setAttribute('position',new THREE.BufferAttribute(snowPositions,3));
  const snow=new THREE.Points(snowGeometry,new THREE.PointsMaterial({color:0xffffff,size:.16,transparent:true,opacity:.9,depthWrite:false}));
  for(const object of [rain,snow]){object.frustumCulled=false;object.userData.projectile=true;object.raycast=()=>{};object.visible=false;scene.add(object);}
  // Some pedestrians carry umbrellas that open when it rains.
  const umbrellas=[];
  {
    const umbrellaColors=['#1f2d4a','#8c2f39','#2f4f3f','#1b1b1f','#c9a26b','#3f6f8f','#e0b84a'];
    pedestrians.forEach((npc,i)=>{
      if(npc.thug || npc.cop || npc.settled || random(npc.seed*3.1+7)>.24)return;
      const b=new ToyKit.Builder(),color=umbrellaColors[i%umbrellaColors.length];
      b.add(ToyKit.cone(.62,.3,12),color,{p:[0,2.25,0]});b.add(ToyKit.sphere(.035,6,4),color,{p:[0,2.42,0]});
      b.rod([0,1.25,0],[0,2.25,0],.015,'#2b2b2b');
      const umbrella=b.mesh();umbrella.position.set(.2,0,-.05);umbrella.visible=false;umbrella.castShadow=false;npc.group.add(umbrella);umbrellas.push(umbrella);
    });
  }
  let rainSound=null;
  function updateRainSound() {
    const noiseBuffer=whiteNoise();if(!soundContext || soundContext.state!=='running' || !noiseBuffer)return;
    if(!rainSound) {
      const source=soundContext.createBufferSource(),filter=soundContext.createBiquadFilter(),gain=soundContext.createGain();
      source.buffer=noiseBuffer;source.loop=true;filter.type='lowpass';filter.frequency.value=1600;gain.gain.value=0;
      source.connect(filter);filter.connect(gain);gain.connect(effectsBus);source.start();rainSound={gain};
    }
    rainSound.gain.gain.setTargetAtTime(weather==='rain'?precipitation*.09:0,soundContext.currentTime,.5);
  }
  function setWeather(next) {
    if(next===weatherTarget)return;
    weatherTarget=next;
    for(const umbrella of umbrellas)umbrella.visible=next==='rain';
    if(next!=='clear')showBreaking(next==='rain'?'RAIN MOVING IN':'SNOW FALLING ACROSS THE CITY');
  }
  function updateEnvironment(dt) {
    dayHour=(dayHour+dt*.025)%24;
    // Sun elevation follows a simple arc from 6:00 to 18:00.
    const angle=(dayHour-6)/12*Math.PI,elevation=Math.sin(angle);
    sunDir.set(-Math.cos(angle)*.55,Math.max(-.6,elevation),.35).normalize();
    nightAmount=1-THREE.MathUtils.smoothstep(elevation,-.18,.08);duskAmount=Math.exp(-((elevation-.05)**2)/.02)*(1-nightAmount*.7);
    weatherTimer-=dt;
    if(weatherTimer<=0){weatherTimer=150+Math.random()*180;const roll=Math.random();setWeather(roll<.55?'clear':roll<.85?'rain':'snow');}
    if(weather!==weatherTarget && precipitation<.02)weather=weatherTarget;
    const wet=weatherTarget!=='clear'&&weather===weatherTarget;
    precipitation+=((wet?1:0)-precipitation)*(1-Math.exp(-dt*.25));overcast+=((weatherTarget==='clear'?0:.85)-overcast)*(1-Math.exp(-dt*.2));
    const uniforms=sky.material.uniforms;uniforms.uSun.value.copy(sunDir);uniforms.uNight.value=nightAmount;uniforms.uDusk.value=duskAmount;uniforms.uOvercast.value=overcast;uniforms.uTime.value=elapsed;
    // Lights, fog and exposure follow the sky.
    const daylight=1-nightAmount;
    sun.color.copy(daySun).lerp(duskSun,duskAmount).lerp(moonLight,nightAmount);sun.intensity=(3.15*daylight+.8*nightAmount)*(1-overcast*.55);
    hemi.intensity=(1.38*daylight+.55*nightAmount)*(1-overcast*.2);hemi.color.setHex(nightAmount>.5?0x5a6f99:0xd9edff);fill.intensity=.55*daylight+.12;
    fogColor.copy(dayFog).lerp(duskFog,duskAmount*.7).lerp(weather==='snow'?snowFog:rainFog,overcast*.8).lerp(nightFog,nightAmount);
    scene.fog.color.copy(fogColor);scene.background.copy(fogColor);
    scene.fog.far=THREE.MathUtils.lerp(1150,weather==='snow'?520:430,precipitation);scene.fog.near=THREE.MathUtils.lerp(260,60,precipitation);
    renderer.toneMappingExposure=1.12-nightAmount*.12;
    for(const facade of nightFacades)facade.emissiveIntensity=nightAmount*.85;
    headlightMat.emissiveIntensity=.38+nightAmount*2.2;
    lampGlow.visible=lampPools.visible=nightAmount>.05;lampGlow.material.opacity=nightAmount;lampPools.material.opacity=nightAmount*.45;
    // Precipitation wraps around the camera.
    rain.visible=weather==='rain' && precipitation>.02;snow.visible=weather==='snow' && precipitation>.02;
    rain.material.opacity=.55*precipitation;snow.material.opacity=.9*precipitation;
    if(rain.visible||snow.visible) {
      const c=camera.position,t=elapsed;
      for(let i=0;i<dropCount;i++) {
        const sx=dropSeeds[i*3],sz=dropSeeds[i*3+2];
        if(rain.visible) {
          const fall=(dropSeeds[i*3+1]-t*34)%40,y=c.y+20+(fall<0?fall+40:fall)-20;
          const x=c.x+((sx-c.x%70+105)%70)-35,z=c.z+((sz-c.z%70+105)%70)-35;
          rainPositions.set([x,y,z,x+.05,y+.9,z+.03],i*6);
        } else {
          const fall=(dropSeeds[i*3+1]-t*2.2)%40,y=c.y+20+(fall<0?fall+40:fall)-20;
          const x=c.x+((sx+Math.sin(t+i)*.8-c.x%70+105)%70)-35,z=c.z+((sz-c.z%70+105)%70)-35;
          snowPositions.set([x,y,z],i*3);
        }
      }
      (rain.visible?rainGeometry:snowGeometry).attributes.position.needsUpdate=true;
    }
    updateRainSound();
    if(clockHud){const hour=Math.floor(dayHour),minute=Math.floor((dayHour%1)*60);clockHud.textContent=`${(hour+11)%12+1}:${String(minute).padStart(2,'0')} ${hour<12?'AM':'PM'}${weather==='rain'?' • Rain':weather==='snow'?' • Snow':''}`;}
  }
  // ---- City events: a parade balloon and river traffic ----
  const balloon=(()=>{
    const b=new ToyKit.Builder(),tan='#c99a63',red='#d33a35',dark='#2a1d16';
    b.add(ToyKit.sphere(1,20,14),tan,{s:[5,4.2,7.5]});b.add(ToyKit.sphere(1,20,14),tan,{p:[0,3.6,-6.5],s:[4.2,4,4]});
    b.add(ToyKit.sphere(1,16,12),'#a07447',{p:[0,2.5,-10.2],s:[2.2,1.6,1.5]});b.add(ToyKit.sphere(.8,10,8),dark,{p:[0,3.1,-11.6]});
    for(const side of [-1,1]) {
      b.add(ToyKit.cone(1.5,2.6,10),'#8a6038',{p:[side*3,7.3,-6],r:[0,0,side*.5]});
      b.add(ToyKit.sphere(.7,12,8),'#f4f1ea',{p:[side*1.5,4.7,-9.9]});b.add(ToyKit.sphere(.38,10,8),dark,{p:[side*1.5,4.7,-10.4]});
      for(const z of [-4,4])b.ellipsoid([side*2.6,-2.5,z],[side*2.8,-6.5,z],1.2,1.2,tan,0,1);
    }
    b.add(ToyKit.torus(4.25,.55,8,24),red,{p:[0,3.8,-6.4],r:[0,0,0],s:[1,.3,1]});
    b.add(ToyKit.cone(1.4,4,8),tan,{p:[0,2,8.4],r:[Math.PI/2+.4,0,0]});
    const group=new THREE.Group(),body=b.mesh();body.userData.balloon=true;group.add(body);group.visible=false;group.userData.skyline=true;scene.add(group);
    const ropes=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(6*6),3)),new THREE.LineBasicMaterial({color:0xe8e2d4}));
    ropes.frustumCulled=false;ropes.raycast=()=>{};ropes.userData.projectile=true;scene.add(ropes);ropes.visible=false;
    grappleMeshes.push(body);
    return {group,body,ropes,active:false,popped:0,hits:0,z:0,timer:200};
  })();
  function hitBalloon() {
    if(!balloon.active || balloon.popped)return;
    balloon.hits++;playEffect('splat',balloon.group.position);
    if(balloon.hits>=8){balloon.popped=.001;playEffect('collapse',balloon.group.position);awardChaos(800,'PARADE BALLOON POPPED',balloon.group.position.clone(),'hit');addHeat(1.2);impactFeedback(3);
      burst(balloon.group.position,90,[0xc99a63,0xd33a35,0xffffff],{speed:18,up:6,life:1.6,size:.6});}
  }
  function updateBalloon(dt) {
    const event=balloon,group=event.group;
    if(!event.active) {
      event.timer-=dt;
      if(event.timer<=0 && !nuke){event.active=true;event.z=-205;event.hits=0;event.popped=0;group.visible=event.ropes.visible=true;group.scale.setScalar(1);showBreaking('THE PARADE IS COMING DOWN CENTRAL PARK WEST');}
      return;
    }
    if(event.popped) {
      event.popped+=dt;group.position.y+=dt*(10+event.popped*12);group.rotation.z+=dt*3;group.scale.setScalar(Math.max(.05,1-event.popped*.45));event.ropes.visible=false;
      if(event.popped>2.5){event.active=false;group.visible=false;event.timer=420;}
      return;
    }
    event.z+=dt*2.6;group.position.set(-80,34+Math.sin(elapsed*.6)*.8,event.z);group.rotation.set(Math.sin(elapsed*.4)*.04,Math.PI,Math.sin(elapsed*.5)*.05);
    const ropes=event.ropes.geometry.attributes.position;
    [[-3,-4],[3,-4],[-3,4],[3,4],[-1.5,-9],[1.5,-9]].forEach(([dx,dz],i)=>{ropes.setXYZ(i*2,-80+dx,30,event.z-dz);ropes.setXYZ(i*2+1,-80+dx*1.8,.6,event.z-dz*1.2);});
    ropes.needsUpdate=true;event.ropes.geometry.computeBoundingSphere();
    if(event.z>330){event.active=false;group.visible=event.ropes.visible=false;event.timer=420;}
  }
  function makeBoat(hull,cabin,length) {
    const b=new ToyKit.Builder();
    b.add(ToyKit.roundedBox(length*.32,1.6,length,.6),hull,{p:[0,.3,0]});b.add(ToyKit.roundedBox(length*.24,2.2,length*.35,.3),cabin,{p:[0,2.2,length*.08]});
    b.add(ToyKit.cylinder(.35,.45,2.2,10),'#2b2b2b',{p:[0,4,length*.15]});
    const group=new THREE.Group(),mesh=b.mesh();group.add(mesh);group.userData.skyline=true;scene.add(group);grappleMeshes.push(mesh);return group;
  }
  const boats=[
    {group:makeBoat('#d9732a','#f2f0ea',30),x:()=>-40,z:t=>1120+Math.sin(t*.02)*90,heading:t=>Math.cos(t*.02)>0?0:Math.PI},
    {group:makeBoat('#b8342f','#2b3a4a',12),x:()=>312,z:t=>200+Math.sin(t*.015)*700,heading:t=>Math.cos(t*.015)>0?0:Math.PI},
    {group:makeBoat('#2f5c8a','#f2f0ea',12),x:()=>-345,z:t=>-100+Math.sin(t*.012+2)*650,heading:t=>Math.cos(t*.012+2)>0?0:Math.PI}
  ];
  function updateEvents(dt) {
    updateBalloon(dt);
    for(const boat of boats){boat.group.position.set(boat.x(elapsed),-.25+Math.sin(elapsed*1.3)*.08,boat.z(elapsed));boat.group.rotation.y=boat.heading(elapsed);}
  }
  // ---- Enterable areas: built high above the outer water so they never meet the city ----
  const fadeLayer=document.getElementById('fade'),interactPrompt=document.getElementById('interact');
  const entrances=[],interactables=[];let currentArea=null,areaTransition=false,uiOpen=false;
  function areaBox(area,w,h,d,color,x,y,z,{collide=true,walkable=false,grapple=false,material=null}={}) {
    const b=new ToyKit.Builder();b.add(ToyKit.roundedBox(w,h,d,Math.min(.08,w/4,h/4,d/4),1),color);
    const mesh=b.mesh(material||ToyKit.toyMaterial);mesh.position.set(x,y,z);mesh.castShadow=false;mesh.receiveShadow=true;area.group.add(mesh);
    if(collide){const c={x,z,w,d,bottom:y-h/2,height:y+h/2,walkable};playerBuildingColliders.push(c);area.colliders.push(c);}
    if(grapple)grappleMeshes.push(mesh);
    return mesh;
  }
  function makeArea(name,origin,ceiling) {
    const group=new THREE.Group();group.userData.skyline=true;scene.add(group);
    const area={name,origin,ceiling,group,colliders:[],update:null,onEnter:null,exits:[]};return area;
  }
  function fadeThen(action) {
    if(areaTransition)return;areaTransition=true;fadeLayer?.classList.add('on');
    setTimeout(()=>{action();setTimeout(()=>{fadeLayer?.classList.remove('on');areaTransition=false;},120);},380);
  }
  function teleportPlayer(point,facing=null) {
    if(rope)swing(false);cancelWebGrab();
    position.copy(point);previous.copy(point);velocity.set(0,0,0);onGround=false;if(facing!==null)yaw=facing;
    updateCityLod(0,true);updateSceneDetail(true);
  }
  function enterArea(area,spawn,facing,from) {
    fadeThen(()=>{currentArea=area;area.returnPoint=from?.exit||position.clone();area.returnFacing=from?.facing??yaw;teleportPlayer(spawn,facing);area.onEnter?.(from);document.querySelector('.game-shell').classList.add('in-area');});
  }
  function leaveArea(point=null,facing=null) {
    const area=currentArea;if(!area)return;
    fadeThen(()=>{currentArea=null;teleportPlayer(point||area.returnPoint,facing??area.returnFacing);area.onLeave?.();document.querySelector('.game-shell').classList.remove('in-area');});
  }
  function addEntrance(label,point,radius,action,exitPoint,facing) {const entrance={label,point,radius,action,exit:exitPoint,facing};entrances.push(entrance);interactables.push(entrance);return entrance;}
  function nearestInteractable() {
    let best=null,bestDistance=Infinity;
    for(const item of interactables) {
      if(item.enabled && !item.enabled())continue;
      const d=item.point.distanceTo(position);if(d<item.radius && d<bestDistance){best=item;bestDistance=d;}
    }
    return best;
  }
  function interact() {
    if(areaTransition || uiOpen || titleOpen || paused)return;
    const target=nearestInteractable();if(target)target.action(target);
  }
  function updateInteractPrompt() {
    const target=!areaTransition && !uiOpen?nearestInteractable():null;
    if(!interactPrompt)return;
    interactPrompt.hidden=!target;if(target)interactPrompt.textContent=`${touchDevice?'Tap':keyName(keyBindings.interact)}: ${target.label}`;
  }
