  // A street kiosk: railings around a stairwell, two globe lamps and a sign.
  function streetKiosk(point,facing,sign,color,lamp) {
    const b=new ToyKit.Builder();
    b.add(ToyKit.roundedBox(2.6,.1,3.6,.04),'#1c1f22',{p:[0,.05,0]});
    for(const side of [-1,1]){b.rod([side*1.3,0,-1.8],[side*1.3,1.1,-1.8],.04,color);b.rod([side*1.3,0,1.8],[side*1.3,1.1,1.8],.04,color);b.rod([side*1.3,1.1,-1.8],[side*1.3,1.1,1.8],.04,color);}
    b.rod([-1.3,1.1,1.8],[1.3,1.1,1.8],.04,color);
    for(const side of [-1,1]){b.rod([side*1.3,1.1,-1.8],[side*1.3,2.4,-1.8],.04,color);b.add(ToyKit.sphere(.2,12,8),lamp,{p:[side*1.3,2.55,-1.8]});}
    const group=new THREE.Group();group.add(b.mesh());group.position.copy(point);group.rotation.y=facing;scene.add(group);
    const board=new THREE.Mesh(new THREE.PlaneGeometry(2.4,.5),displayMaterial(sign,'',color==='#1d5c3a'?'#176b4c':'#3a2b1d'));board.position.set(0,1.75,-1.82);group.add(board);
    const back=board.clone();back.rotation.y=Math.PI;back.position.z=-1.84;group.add(back);
    return group;
  }
  // ---- Subway: stations across the city share one platform and a tunnel ----
  const subwayArea=makeArea('SUBWAY',new THREE.Vector3(720,600,-600),606.5);
  const subwayStations=[['HARLEM 125 ST',-33.6,-551],['TIMES SQ 42 ST',47,214],['UNION SQ 14 ST',86.4,529],['WALL ST',46.4,849],['DUMBO YORK ST',446.4,809],['CONEY ISLAND',606.4,1049]];
  {
    const a=subwayArea,o=a.origin,tile='#e9e4d8',band='#1d5c3a';
    // Platform, edge strip, back wall with a tiled band, ceiling and the track pit.
    areaBox(a,7,1,90,'#8c8f93',o.x-4.5,o.y-.5,o.z,{walkable:true});
    areaBox(a,.5,.04,90,'#e8c33a',o.x-1.25,o.y+.02,o.z,{collide:false});
    areaBox(a,1,8,90,tile,o.x-8.5,o.y+3,o.z,{grapple:true});
    areaBox(a,.2,1.2,90,band,o.x-7.95,o.y+2.2,o.z,{collide:false});
    areaBox(a,22,1,1200,'#3a3d40',o.x+2,o.y+7,o.z+500,{collide:false,grapple:true});
    areaBox(a,8,1,1200,'#2b2722',o.x+3,o.y-2.3,o.z+500,{walkable:true});
    areaBox(a,1,10,1200,'#3d3a36',o.x+7.5,o.y+2,o.z+500,{grapple:true});
    areaBox(a,1,10,1110,'#3d3a36',o.x-8.5,o.y+2,o.z+555,{collide:true});
    areaBox(a,16,10,1,'#3d3a36',o.x,o.y+2,o.z-46,{});
    for(const x of [o.x+1.2,o.x+4.8])areaBox(a,.12,.14,1200,'#9aa2a6',x,o.y-1.73,o.z+500,{collide:false});
    for(let z=-40;z<=40;z+=10){areaBox(a,.45,7,.45,'#2f6b4f',o.x-1.6,o.y+3.5,o.z+z,{grapple:true});}
    for(let z=-30;z<=30;z+=20)areaBox(a,2.4,.5,.6,'#6b4a2e',o.x-6.6,o.y+.5,o.z+z,{walkable:true});
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(10,1.2),displayMaterial('SKYLINE LINE','Downtown and Brooklyn','#1d5c3a'));sign.position.set(o.x-7.9,o.y+4.6,o.z);sign.rotation.y=Math.PI/2;a.group.add(sign);
    // Tunnel lights run the length of the line.
    const lights=new THREE.InstancedMesh(new THREE.BoxGeometry(.2,.3,1.2),new THREE.MeshBasicMaterial({color:0xffd98a,toneMapped:false}),120),t=new THREE.Object3D();
    for(let i=0;i<120;i++){t.position.set(o.x+6.9,o.y+4,o.z+40+i*9);t.updateMatrix();lights.setMatrixAt(i,t.matrix);}
    a.group.add(lights);
    // Exit stairs at the back of the platform.
    areaBox(a,3,.4,4,'#6c6f73',o.x-6.5,o.y+.2,o.z-40,{collide:false});
    a.exits.push(o.clone().add(new THREE.Vector3(-6,1,-40)));
  }
  // The train: three silver cars with blue stripes and a walkable roof.
  const train=(()=>{
    const b=new ToyKit.Builder();
    for(let car=0;car<3;car++) {
      const z=(car-1)*18.5;
      b.add(ToyKit.roundedBox(3,3.6,18,.35),'#b9c0c4',{p:[0,0,z]});
      for(const side of [-1,1]){b.add(ToyKit.roundedBox(.06,.35,17.6,.03),'#2a5cbf',{p:[side*1.52,-.6,z]});for(let w=-3;w<=3;w++)b.add(ToyKit.roundedBox(.06,.9,1.6,.05),'#20262c',{p:[side*1.52,.55,z+w*2.3]});}
    }
    b.add(ToyKit.roundedBox(2.4,1.4,.1,.05),'#20262c',{p:[0,.5,-27.6]});
    const group=new THREE.Group(),mesh=b.mesh(ToyKit.metalMaterial);group.add(mesh);subwayArea.group.add(group);
    const roof={x:subwayArea.origin.x+3,z:0,w:3,d:55,bottom:subwayArea.origin.y-2,height:subwayArea.origin.y+1.6,walkable:true};
    movingColliders.push(roof);
    return {group,roof,z:-700,speed:0,state:'arriving',timer:0,surfing:false,surfScore:0};
  })();
  const trainStop=-600,trainEnd=230;
  const trainObstacles=[];
  for(let z=-500;z<trainEnd-20;z+=34+Math.round(random(z)*22)) {
    const box=areaBox(subwayArea,3.4,.9,.7,'#c9a227',subwayArea.origin.x+3,subwayArea.origin.y+2.05,z,{});trainObstacles.push(box);
  }
  function updateTrain(dt) {
    const o=subwayArea.origin,t=train,oldZ=t.z;
    if(t.state==='arriving'){t.speed=Math.max(3,(trainStop-t.z)*.55);t.z=Math.min(trainStop,t.z+t.speed*dt);if(t.z>=trainStop){t.state='stopped';t.timer=8;t.speed=0;}}
    else if(t.state==='stopped'){t.timer-=dt;if(t.timer<=0){t.state='departing';t.surfing=onTrainRoof();if(t.surfing){showBreaking('HOLD ON. JUMP THE SIGNAL BOXES.');}}}
    else if(t.state==='departing'){t.speed=Math.min(22,t.speed+5*dt);t.z+=t.speed*dt;if(t.z>trainEnd){if(t.surfing)finishSurf(true);t.state='away';t.timer=6;}}
    else if(t.state==='away'){t.timer-=dt;if(t.timer<=0){t.state='arriving';t.z=-700;}}
    t.group.position.set(o.x+3,o.y-.2,t.z);t.roof.z=t.z;
    // A rider on the roof moves with the train.
    if(currentArea===subwayArea && onTrainRoof())position.z+=t.z-oldZ;
    if(t.surfing && t.state==='departing') {
      if(position.y<o.y+.6)finishSurf(false);
      else{t.surfScore+=dt;}
    }
  }
  function onTrainRoof(){const o=subwayArea.origin;return currentArea===subwayArea && Math.abs(position.x-(o.x+3))<1.7 && Math.abs(position.z-train.z)<28 && position.y>o.y+.9 && position.y<o.y+2.6;}
  function finishSurf(success) {
    train.surfing=false;
    if(success){awardChaos(1500,'SUBWAY SURFER',null,'trick');gainBucks(60);const station=subwayStations[Math.floor(Math.random()*subwayStations.length)];travelTo(station);}
    else{showBreaking('KNOCKED OFF THE TRAIN');fadeThen(()=>teleportPlayer(subwayArea.origin.clone().add(new THREE.Vector3(-4,1,-30)),Math.PI));}
  }
  // Riding inside picks a destination station.
  const travelMenu=document.getElementById('travel'),travelList=document.getElementById('travel-list');
  function travelTo([name,x,z]) {
    closeTravel();
    const exit=new THREE.Vector3(x+2.5,.5,z);
    fadeThen(()=>{currentArea=null;document.querySelector('.game-shell').classList.remove('in-area');teleportPlayer(exit,Math.PI/2);showBreaking(name);});
  }
  function openTravel() {
    if(!travelMenu)return;uiOpen=true;travelMenu.hidden=false;travelList.innerHTML='';
    subwayStations.forEach((station,i)=>{const button=document.createElement('button');button.type='button';button.textContent=`${i+1}. ${station[0]}`;button.addEventListener('click',()=>travelTo(station));travelList.appendChild(button);});
    if(document.pointerLockElement===canvas)document.exitPointerLock();
  }
  function closeTravel() {
    if(!travelMenu)return;uiOpen=false;travelMenu.hidden=true;
    if(!touchDevice && canvas.requestPointerLock){const request=canvas.requestPointerLock();if(request?.catch)request.catch(()=>{});}
  }
  document.getElementById('travel-close')?.addEventListener('click',closeTravel);
  // Street entrances lead down to the platform; the stairs at the back lead up again.
  for(const [name,x,z] of subwayStations) {
    const point=new THREE.Vector3(x,.45,z);
    if(name!=='TIMES SQ 42 ST')streetKiosk(point,0,'SUBWAY','#1d5c3a','#7fdc9a');
    addEntrance(`Enter ${name} station`,point,3,()=>enterArea(subwayArea,subwayArea.origin.clone().add(new THREE.Vector3(-5,1,-34)),Math.PI,{exit:new THREE.Vector3(x+3,.5,z),facing:Math.PI/2}),null,0);
  }
  interactables.push({label:'Climb the stairs to the street',point:subwayArea.exits[0],radius:3.5,enabled:()=>currentArea===subwayArea,action:()=>leaveArea()});
  interactables.push({label:'Board the train',get point(){return new THREE.Vector3(subwayArea.origin.x-1,subwayArea.origin.y+1,THREE.MathUtils.clamp(position.z,train.z-26,train.z+26));},radius:2.6,enabled:()=>currentArea===subwayArea && train.state==='stopped' && position.y<subwayArea.origin.y+1.6,action:openTravel});
  // ---- Museum of Natural History: indoor swinging, a T. rex, a whale and a laser vault ----
  const museumArea=makeArea('MUSEUM',new THREE.Vector3(690,600,-280),626);
  const lasers=[];let fossilTaken=false;
  try{fossilTaken=localStorage.getItem('spida.fossil')==='1';}catch(_){/* Not taken yet. */}
  {
    const a=museumArea,o=a.origin,marble='#e7e1d4',trim='#b9ad97';
    areaBox(a,34,1,74,'#cfc6b4',o.x,o.y-.5,o.z,{walkable:true});
    for(const side of [-1,1])areaBox(a,1,27,74,marble,o.x+side*17,o.y+13,o.z,{grapple:true});
    areaBox(a,34,27,1,marble,o.x,o.y+13,o.z-37,{grapple:true});areaBox(a,34,27,1,marble,o.x,o.y+13,o.z+37,{grapple:true});
    areaBox(a,34,1,74,'#d9d2c2',o.x,o.y+26.5,o.z,{collide:false,grapple:true});
    // Ceiling beams and columns are anchors for swinging around the hall.
    for(let z=-30;z<=30;z+=10)areaBox(a,32,1.2,.9,trim,o.x,o.y+24,o.z+z,{collide:false,grapple:true});
    for(const side of [-1,1])for(let z=-28;z<=28;z+=14){areaBox(a,1.6,26,1.6,trim,o.x+side*13,o.y+13,o.z+z,{grapple:true});}
    // A mezzanine runs along both long walls.
    for(const side of [-1,1]){areaBox(a,4,.5,70,'#bdb3a0',o.x+side*15,o.y+9,o.z,{walkable:true});areaBox(a,.2,1.1,70,'#7a6a52',o.x+side*13,o.y+9.8,o.z,{collide:false});}
    // T. rex skeleton built from bone segments.
    const bones=new ToyKit.Builder(),bone='#e9dfc6',cx=o.x,cz=o.z-6;
    bones.ellipsoid([cx,o.y+5,cz+3],[cx,o.y+6.2,cz-4],1.2,1.6,bone,0,1);
    for(let i=0;i<10;i++)bones.ellipsoid([cx,o.y+5.6+Math.sin(i*.5)*.1,cz+4+i*1.1],[cx,o.y+5.3-i*.3,cz+5.1+i*1.1],.35-i*.025,.35-i*.025,bone,0,1.3);
    for(let i=0;i<7;i++)bones.add(ToyKit.torus(1.3-i*.08,.08,6,16,Math.PI),bone,{p:[cx,o.y+5.4,cz-2+i*1],r:[0,Math.PI/2,Math.PI]});
    bones.ellipsoid([cx,o.y+6.4,cz-4],[cx,o.y+8.4,cz-6.5],.45,.45,bone,0,1);
    bones.add(ToyKit.roundedBox(1.4,1.6,3.2,.4),bone,{p:[cx,o.y+9,cz-8]});
    for(let t=0;t<6;t++)bones.add(ToyKit.cone(.08,.3,5),'#f6f0e2',{p:[cx-.45+t*.18,o.y+8.2,cz-9.4],r:[Math.PI,0,0]});
    for(const side of [-1,1]) {
      bones.ellipsoid([cx+side*.8,o.y+5,cz],[cx+side*.9,o.y+2.6,cz+1.2],.4,.4,bone,0,1);bones.ellipsoid([cx+side*.9,o.y+2.6,cz+1.2],[cx+side*.9,o.y+.4,cz],.28,.28,bone,0,1);
      bones.add(ToyKit.roundedBox(.6,.25,1.2,.1),bone,{p:[cx+side*.9,o.y+.2,cz-.4]});
      bones.ellipsoid([cx+side*.6,o.y+6.2,cz-3.6],[cx+side*.8,o.y+5.6,cz-4.6],.12,.12,bone,0,1);
    }
    bones.add(ToyKit.roundedBox(5,.5,12,.1),'#5c544a',{p:[cx,o.y+.25,cz+2]});
    const rex=bones.mesh();a.group.add(rex);grappleMeshes.push(rex);a.colliders.push(...[{x:cx,z:cz+2,w:5,d:12,bottom:o.y-.1,height:o.y+.5,walkable:true}]);playerBuildingColliders.push(a.colliders[a.colliders.length-1]);
    // A blue whale hangs over the far end of the hall.
    const whale=new ToyKit.Builder(),blue='#53718f';
    whale.ellipsoid([o.x,o.y+17,o.z+14],[o.x,o.y+17.5,o.z+32],3.4,2.6,blue,0,1.05);
    whale.add(ToyKit.cone(2.2,4,10),blue,{p:[o.x,o.y+17,o.z+11.6],r:[-Math.PI/2,0,0]});
    whale.add(ToyKit.roundedBox(7,.3,2,.1),blue,{p:[o.x,o.y+17,o.z+9.6]});
    for(const side of [-1,1])whale.add(ToyKit.roundedBox(3.6,.3,1.4,.1),blue,{p:[o.x+side*3.4,o.y+16,o.z+26],r:[0,side*.4,side*.3]});
    whale.add(ToyKit.roundedBox(5.4,.6,14,.25),'#e6ddd0',{p:[o.x,o.y+15,o.z+24]});
    for(const side of [-1,1])whale.rod([o.x+side*2,o.y+18.8,o.z+22],[o.x+side*2,o.y+26,o.z+22],.06,'#444');
    const whaleMesh=whale.mesh();a.group.add(whaleMesh);grappleMeshes.push(whaleMesh);
    const banner=new THREE.Mesh(new THREE.PlaneGeometry(14,2.4),displayMaterial('NATURAL HISTORY','Hall of Big Things','#7a5a2e'));banner.position.set(o.x,o.y+20,o.z-36.4);a.group.add(banner);
    // The laser vault: a short corridor at the far wall guarding a golden fossil.
    areaBox(a,1,6,16,marble,o.x-6.6,o.y+3,o.z+28,{});areaBox(a,10.4,1,16,trim,o.x-11.8,o.y+6.5,o.z+28,{collide:false});
    const pedestal=areaBox(a,1.4,1.2,1.4,'#7a6a52',o.x-12,o.y+.6,o.z+31,{walkable:true});
    const fossil=new THREE.Mesh(new THREE.IcosahedronGeometry(.45,1),new THREE.MeshStandardMaterial({color:0xffc83a,emissive:0xff9a1a,emissiveIntensity:.6,metalness:.6,roughness:.3}));
    fossil.position.set(o.x-12,o.y+1.75,o.z+31);fossil.visible=!fossilTaken;a.group.add(fossil);a.fossil=fossil;
    for(let i=0;i<5;i++) {
      const beam=new THREE.Mesh(new THREE.BoxGeometry(10,.06,.06),new THREE.MeshBasicMaterial({color:0xff2a2a,toneMapped:false}));
      beam.position.set(o.x-12,o.y+1,o.z+22.5+i*1.7);a.group.add(beam);lasers.push({beam,phase:i*1.3,speed:.9+i*.25,baseZ:o.z+22.5+i*1.7});
    }
    a.exits.push(o.clone().add(new THREE.Vector3(0,1,-34)));
  }
  let laserCooldown=0;
  museumArea.update=dt=>{
    const o=museumArea.origin;laserCooldown=Math.max(0,laserCooldown-dt);
    for(const laser of lasers) {
      // Beams sweep up and down; touching one trips the alarm.
      const y=o.y+.4+(Math.sin(elapsed*laser.speed+laser.phase)*.5+.5)*2.6;laser.beam.position.y=y;
      if(laserCooldown<=0 && Math.abs(position.z-laser.baseZ)<.35 && Math.abs(position.x-(o.x-12))<5 && position.y<y && position.y+1.8>y) {
        laserCooldown=1.5;playEffect('alert');showBreaking('ALARM');addHeat(1);shell.classList.remove('hurt');void shell.offsetWidth;shell.classList.add('hurt');
        fadeThen(()=>teleportPlayer(o.clone().add(new THREE.Vector3(-12,1,18)),0));
      }
    }
    if(museumArea.fossil.visible){museumArea.fossil.rotation.y+=dt*1.5;}
  };
  interactables.push({label:'Take the golden fossil',get point(){return museumArea.fossil.position;},radius:2.2,enabled:()=>currentArea===museumArea && museumArea.fossil.visible,action:()=>{
    museumArea.fossil.visible=false;try{localStorage.setItem('spida.fossil','1');}catch(_){/* Session only. */}
    awardChaos(2500,'GOLDEN FOSSIL',museumArea.fossil.position.clone(),'hero');gainBucks(250);playEffect('success');burst(museumArea.fossil.position,60,confetti,{speed:10,up:6,life:1.4,size:.3});
  }});
  interactables.push({label:'Leave the museum',point:museumArea.exits[0],radius:3,enabled:()=>currentArea===museumArea,action:()=>leaveArea()});
  {
    // The entrance portico faces Central Park West.
    const b=new ToyKit.Builder(),stone='#d8cfbd';
    b.add(ToyKit.roundedBox(3.4,.4,12,.1),stone,{p:[0,.2,0]});
    for(let i=-2;i<=2;i++)b.add(ToyKit.cylinder(.32,.36,7,14),stone,{p:[.6,3.9,i*2.6]});
    b.add(ToyKit.roundedBox(2.6,1,12.6,.1),stone,{p:[.6,7.8,0]});
    b.add(ToyKit.roundedBox(2.2,.5,1.6,.05),'#2b2620',{p:[-.6,1.5,0]});
    const portico=new THREE.Group();portico.add(b.mesh());portico.position.set(-85.8,.45,-60);scene.add(portico);grappleMeshes.push(portico.children[0]);
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(10,1),displayMaterial('MUSEUM OF NATURAL HISTORY','','#7a5a2e'));sign.position.set(.62+.75,7.8,0);sign.rotation.y=Math.PI/2;portico.add(sign);
    addEntrance('Enter the Museum of Natural History',new THREE.Vector3(-84.5,.45,-60),3.2,()=>enterArea(museumArea,museumArea.origin.clone().add(new THREE.Vector3(0,1,-32)),Math.PI,{exit:new THREE.Vector3(-82.5,.5,-60),facing:-Math.PI/2}),null,0);
  }
  // Bucks are earned by heroics and spent at the bodega.
  const bucksHud=document.getElementById('bucks');
  function gainBucks(amount){progress.bucks=Math.max(0,(progress.bucks||0)+amount);saveProgress();updateBucksHud();}
  function updateBucksHud(){if(bucksHud)bucksHud.textContent=`$${(progress.bucks||0).toLocaleString()}`;}
  // ---- Bodega: a corner store with a cashier, a cat and the shop ----
  const bodegaArea=makeArea('BODEGA',new THREE.Vector3(690,600,-120),604.6);
  {
    const a=bodegaArea,o=a.origin;
    areaBox(a,16,1,12,'#9b8f7e',o.x,o.y-.5,o.z,{walkable:true});
    for(const side of [-1,1]){areaBox(a,1,5,12,'#d8d0bf',o.x+side*8,o.y+2.5,o.z,{});areaBox(a,16,5,1,'#d8d0bf',o.x,o.y+2.5,o.z+side*6,{});}
    areaBox(a,16,.4,12,'#f1ece0',o.x,o.y+4.8,o.z,{collide:false});
    // Shelves of brightly packed goods.
    const goods=['#d94f4f','#e0b84a','#3fa7a0','#2f6fd9','#f2f0ea','#7a2f3f','#5c7d5a'];
    for(const x of [-4,0]) {
      areaBox(a,1,2.2,7,'#6b5a43',o.x+x,o.y+1.1,o.z+1,{});
      const shelf=new ToyKit.Builder();
      for(let row=0;row<3;row++)for(let i=0;i<12;i++)for(const side of [-1,1])shelf.add(ToyKit.roundedBox(.3,.42,.45,.05),goods[(row*5+i+x)%goods.length],{p:[o.x+x+side*.62,o.y+.5+row*.65,o.z-2+i*.55]});
      a.group.add(shelf.mesh());
    }
    // A glowing drinks fridge along the back wall.
    const fridge=new ToyKit.Builder();fridge.add(ToyKit.roundedBox(5,2.6,.9,.08),'#d9e2e8',{p:[o.x-2,o.y+1.3,o.z+5.2]});
    for(let i=0;i<10;i++)for(let row=0;row<3;row++)fridge.add(ToyKit.cylinder(.09,.09,.32,8),goods[(i+row)%goods.length],{p:[o.x-4+i*.44,o.y+.6+row*.7,o.z+4.8]});
    a.group.add(fridge.mesh(ToyKit.glowMaterial));
    areaBox(a,1.2,1.1,4,'#7a5a3e',o.x+5,o.y+.55,o.z-2,{walkable:true});
    const register=new ToyKit.Builder();register.add(ToyKit.roundedBox(.6,.4,.5,.06),'#2b2b2b',{p:[o.x+5,o.y+1.3,o.z-3.2]});register.add(ToyKit.roundedBox(.5,.28,.04,.02),'#7fdc9a',{p:[o.x+4.92,o.y+1.55,o.z-3.2],r:[0,0,-.3]});a.group.add(register.mesh());
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(6,1),displayMaterial('DELI • GROCERY','Open 24 hours','#c23a2e'));sign.position.set(o.x,o.y+3.6,o.z-5.45);a.group.add(sign);
    a.exits.push(o.clone().add(new THREE.Vector3(0,1,-4.8)));
  }
  const cashier=makePedestrian(bodegaArea.origin.x+6.3,bodegaArea.origin.z-2,9911,0,0,'vendor');
  cashier.settled=true;cashier.group.position.set(bodegaArea.origin.x+6.3,bodegaArea.origin.y,bodegaArea.origin.z-2);cashier.group.rotation.y=Math.PI/2;
  // Cats: one lives in the bodega, more lounge around the city.
  function makeCat(seed) {
    const b=new ToyKit.Builder(),coat=['#e08a3c','#2b2b2b','#d8d0c4','#8a8478'][seed%4],dark='#3a2a20';
    b.ellipsoid([0,.25,.18],[0,.27,-.2],.17,.16,coat,0,1.1);b.add(ToyKit.sphere(.15,12,10),coat,{p:[0,.42,-.3]});
    for(const side of [-1,1]){b.add(ToyKit.cone(.06,.13,6),coat,{p:[side*.08,.57,-.3]});b.add(ToyKit.sphere(.025,6,4),'#c9e86a',{p:[side*.055,.45,-.43]});b.ellipsoid([side*.08,.2,.1],[side*.08,0,.1],.045,.045,coat,0,1);b.ellipsoid([side*.08,.2,-.15],[side*.08,0,-.15],.045,.045,coat,0,1);}
    b.ellipsoid([0,.3,.32],[0,.55,.55],.04,.04,coat,0,1);b.add(ToyKit.sphere(.02,6,4),dark,{p:[0,.4,-.45]});
    return b.mesh();
  }
  let catsPetted=new Set();try{catsPetted=new Set(JSON.parse(localStorage.getItem('spida.cats')||'[]'));}catch(_){/* None yet. */}
  const cats=[];
  {
    const bodegaCat=makeCat(0);bodegaCat.position.set(bodegaArea.origin.x+5,bodegaArea.origin.y+1.1,bodegaArea.origin.z-1);bodegaCat.rotation.y=-Math.PI/2;bodegaArea.group.add(bodegaCat);cats.push(bodegaCat);
    const candidates=buildings.filter(b=>!b.landmark && b.height>6 && b.height<60 && b.x<760).sort((m,n)=>random(m.x*1.7+n.z)-random(n.x*1.7+m.z));
    const down=new THREE.Vector3(0,-1,0);
    for(const b of candidates) {
      if(cats.length>=11)break;
      if(cats.some(c=>Math.hypot(c.position.x-b.x,c.position.z-b.z)<120))continue;
      raycaster.set(new THREE.Vector3(b.x+b.w*.3,400,b.z),down);raycaster.far=420;const hit=raycaster.intersectObjects(grappleMeshes,false)[0];
      if(!hit)continue;const cat=makeCat(cats.length);cat.position.copy(hit.point);cat.rotation.y=random(b.x)*6;cat.userData.skyline=true;scene.add(cat);cats.push(cat);
    }
    raycaster.far=150;
  }
  cats.forEach((cat,i)=>interactables.push({label:'Pet the cat',get point(){return cat.getWorldPosition(new THREE.Vector3());},radius:2.4,enabled:()=>!catsPetted.has(i),action:()=>{
    catsPetted.add(i);try{localStorage.setItem('spida.cats',JSON.stringify([...catsPetted]));}catch(_){/* Session only. */}
    gainBucks(40);awardChaos(300,`CAT ${catsPetted.size}/${cats.length}`,null,'hero');playEffect('success');updateActivityHud();
  }}));
  // The shop: the cashier sells upgrades and early suits for cash.
  const shopItems=[
    {id:'hotdog',name:'Hot dog',note:'Heals you fully',price:15,consumable:true},
    {id:'sneakers',name:'Running sneakers',note:'Sprint faster',price:150},
    {id:'gloves',name:'Weighted gloves',note:'Slaps hit harder',price:180},
    {id:'fluid',name:'Premium web fluid',note:'Web zips recharge faster',price:200},
    {id:'lawyer',name:'Lawyer on retainer',note:'Police heat fades twice as fast',price:220},
    {id:'lining',name:'Armored lining',note:'Take a quarter less damage',price:260},
    ...['symbiote','iron','pajamas','noir','gold'].map(key=>({id:`suit:${key}`,name:`${suits[key].name} suit`,note:'Unlock now',price:300}))
  ];
  const owns=id=>(progress.owned||[]).includes(id);
  const shopMenu=document.getElementById('shop'),shopList=document.getElementById('shop-list'),shopCash=document.getElementById('shop-cash');
  function renderShop() {
    shopCash.textContent=`You have $${(progress.bucks||0).toLocaleString()}`;shopList.innerHTML='';
    shopItems.forEach((item,i)=>{
      const owned=!item.consumable && (owns(item.id)||has(item.id)),button=document.createElement('button');button.type='button';
      button.innerHTML=`<b>${i+1}. ${item.name}</b><span>${item.note}</span><em>${owned?'Owned':`$${item.price}`}</em>`;
      button.disabled=owned || (progress.bucks||0)<item.price;
      button.addEventListener('click',()=>{
        if(button.disabled)return;progress.bucks-=item.price;
        if(item.consumable){playerHp=100;updateHeroHud();}else{progress.owned=[...(progress.owned||[]),item.id];if(item.id.startsWith('suit:'))updateSuitButtons();}
        saveProgress();updateBucksHud();playEffect('success');renderShop();
      });
      shopList.appendChild(button);
    });
  }
  function openShop(){if(!shopMenu)return;uiOpen=true;shopMenu.hidden=false;renderShop();if(document.pointerLockElement===canvas)document.exitPointerLock();}
  function closeShop(){if(!shopMenu)return;uiOpen=false;shopMenu.hidden=true;if(!touchDevice && canvas.requestPointerLock){const request=canvas.requestPointerLock();if(request?.catch)request.catch(()=>{});}}
  document.getElementById('shop-close')?.addEventListener('click',closeShop);
  interactables.push({label:'Shop',point:bodegaArea.origin.clone().add(new THREE.Vector3(4,1,-2)),radius:2.4,enabled:()=>currentArea===bodegaArea,action:openShop});
  interactables.push({label:'Leave the bodega',point:bodegaArea.exits[0],radius:2.2,enabled:()=>currentArea===bodegaArea,action:()=>leaveArea()});
  // Pizza deliveries start from the bodega counter.
  const deliveryBeacon=new THREE.Mesh(beaconGeometry,new THREE.MeshBasicMaterial({color:0x5ee0ff,transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));
  deliveryBeacon.visible=false;deliveryBeacon.userData.projectile=true;deliveryBeacon.raycast=()=>{};scene.add(deliveryBeacon);
  let delivery=null;
  interactables.push({label:'Take a pizza delivery',point:bodegaArea.origin.clone().add(new THREE.Vector3(4,1,1.2)),radius:2,enabled:()=>currentArea===bodegaArea && !delivery,action:()=>{
    const target=pizzaSpots[Math.floor(Math.random()*pizzaSpots.length)].clone();
    delivery={target,time:0,limit:Math.max(45,Math.min(110,target.distanceTo(bodegaArea.returnPoint||position)/9+30)),damageTaken:0,hp:playerHp};
    deliveryBeacon.position.set(target.x,150,target.z);deliveryBeacon.visible=true;showBreaking('DELIVER THE PIZZA BEFORE IT GETS COLD');leaveArea();
  }});
  function updateDelivery(dt) {
    if(!delivery)return;
    delivery.time+=dt;const left=delivery.limit-delivery.time;
    if(playerHp<delivery.hp-30){finishDelivery(false,'THE PIZZA GOT SQUASHED');return;}
    if(left<=0){finishDelivery(false,'THE PIZZA WENT COLD');return;}
    if(raceHud && !race){raceHud.hidden=false;raceHud.textContent=`PIZZA DELIVERY  ${left.toFixed(1)}s  •  ${Math.round(delivery.target.distanceTo(position))} m`;}
    if(delivery.target.distanceTo(position.clone().setY(position.y+1))<4)finishDelivery(true);
  }
  function finishDelivery(success,message) {
    const tip=success?Math.round(40+Math.max(0,delivery.limit-delivery.time)*2):0;delivery=null;deliveryBeacon.visible=false;if(raceHud && !race)raceHud.hidden=true;
    if(success){gainBucks(tip);awardChaos(600,`DELIVERED (+$${tip})`,null,'hero');playEffect('success');}else showBreaking(message);
  }
  // Storefronts with awnings mark the way into a bodega.
  for(const [x,z] of [[126.4,389],[-153.6,-411],[526.4,649],[-33.6,609]]) {
    const b=new ToyKit.Builder();
    b.add(ToyKit.roundedBox(1,3.4,5,.05),'#3a2b1d',{p:[0,1.7,0]});b.add(ToyKit.roundedBox(1.8,.2,5.4,.05),'#c23a2e',{p:[.7,3.3,0]});
    for(let i=-2;i<=2;i++)b.add(ToyKit.roundedBox(1.84,.06,.5,.02),'#f2f0ea',{p:[.7,3.42,i*1.05]});
    b.add(ToyKit.roundedBox(.08,2.2,1.4,.04),'#1b1d20',{p:[.52,1.2,-1.4]});
    for(let i=0;i<3;i++)b.add(ToyKit.roundedBox(.6,.35,.8,.05),['#e0b84a','#d94f4f','#5c7d5a'][i],{p:[.9,.3,.4+i*.85]});
    const front=new THREE.Group();front.add(b.mesh());front.position.set(x,.45,z);scene.add(front);
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(4.6,.7),displayMaterial('DELI • GROCERY','','#c23a2e'));sign.position.set(.53,2.7,0);sign.rotation.y=Math.PI/2;front.add(sign);
    addEntrance('Enter the bodega',new THREE.Vector3(x+1.5,.45,z-1.4),2.6,()=>enterArea(bodegaArea,bodegaArea.origin.clone().add(new THREE.Vector3(0,1,-3.6)),Math.PI,{exit:new THREE.Vector3(x+3,.5,z),facing:-Math.PI/2}),null,0);
  }
  // The Daily Bugle pays once for a photo of each landmark or villain.
  let photosSold=new Set();try{photosSold=new Set(JSON.parse(localStorage.getItem('spida.photos')||'[]'));}catch(_){/* None sold. */}
  const photoSubjects=[['Empire State Building',new THREE.Vector3(60,180,300)],['Chrysler Building',new THREE.Vector3(140,130,260)],['Flatiron Building',new THREE.Vector3(20,30,460)],['Statue of Liberty',new THREE.Vector3(-150,60,1215)],['Brooklyn Bridge',new THREE.Vector3(314,30,760)],['Wonder Wheel',new THREE.Vector3(560,27,1084)],['Times Square',new THREE.Vector3(60,25,220)]];
  function sellPhoto() {
    const sold=[];
    const subjects=[...photoSubjects,...bosses.filter(b=>b.status==='active').map(b=>[b.name,b.actor.group.position.clone().setY(b.actor.group.position.y+2)]),...(balloon.active?[['Parade balloon',balloon.group.position.clone()]]:[])];
    for(const [name,point] of subjects) {
      if(photosSold.has(name) || point.distanceTo(camera.position)>320)continue;
      const projected=point.clone().project(camera);
      if(projected.z<1 && Math.abs(projected.x)<.75 && Math.abs(projected.y)<.75){photosSold.add(name);sold.push(name);}
    }
    if(!sold.length)return;
    try{localStorage.setItem('spida.photos',JSON.stringify([...photosSold]));}catch(_){/* Session only. */}
    gainBucks(sold.length*75);setTimeout(()=>showBreaking(`DAILY BUGLE BUYS YOUR PHOTO: ${sold.join(', ').toUpperCase()} (+$${sold.length*75})`),200);
  }

  updateBucksHud();
  function updateAreas(dt) {
    updateTrain(dt);updateDelivery(dt);updatePigeons(dt);
    if(currentArea)currentArea.update?.(dt);
    updateInteractPrompt();
  }
  // ---- Street and skyline detail, drawn as instanced batches ----
  {
    const transform=new THREE.Object3D(),color=new THREE.Color();
    function batch(geometry,material,items) {
      const mesh=new THREE.InstancedMesh(geometry,material,Math.max(1,items.length));mesh.count=items.length;
      items.forEach((item,i)=>{transform.position.copy(item.p);transform.rotation.set(item.t||0,item.r||0,0,'YXZ');transform.scale.copy(item.s||new THREE.Vector3(1,1,1));transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);if(item.c!==undefined)mesh.setColorAt(i,color.set(item.c));});
      mesh.castShadow=false;mesh.receiveShadow=true;mesh.userData.projectile=true;mesh.raycast=()=>{};mesh.computeBoundingSphere();scene.add(mesh);return mesh;
    }
    const awnings=[],acUnits=[],vents=[],antennas=[],tanks=[];
    const awningColors=['#a3322b','#2f5c3a','#1f3a6b','#c48a2a','#5a2a52','#2b2b2b','#a35a2b'];
    for(const b of buildings) {
      if(b.landmark || b.shape || b.suburb || b.communityKind || b.destroyed || !b.w || b.height<8 || b.walkable)continue;
      const seed=b.x*.37+b.z*.71;
      const faces=[[1,0,b.d],[-1,0,b.d],[0,1,b.w],[0,-1,b.w]];
      faces.forEach(([nx,nz,length],f)=>{
        const fx=b.x+nx*(b.w/2),fz=b.z+nz*(b.d/2),along=new THREE.Vector3(nz,0,nx).normalize(),angle=Math.atan2(nx,nz);
        // Storefront awnings along the ground floor.
        if(random(seed+f)>.35 && !b.rowHouse) {
          const count=Math.max(1,Math.floor(length/7)),c=awningColors[Math.floor(random(seed+f*3)*awningColors.length)];
          for(let i=0;i<count;i++){const t=(i+.5)/count-.5;awnings.push({p:new THREE.Vector3(fx+nx*.85+along.x*t*length*.9,3.3,fz+nz*.85+along.z*t*length*.9),r:angle,t:.38,s:new THREE.Vector3(Math.min(4.5,length/count*.8),1,1),c});}
        }
        // Window air conditioners stick out at random floors.
        const units=Math.min(9,Math.round(length*Math.min(b.height,45)/260));
        for(let i=0;i<units;i++){const t=random(seed+i*7+f)-.5,y=6+random(seed+i*11+f*5)*(Math.min(b.height,45)-9);acUnits.push({p:new THREE.Vector3(fx+nx*.3+along.x*t*length*.85,y,fz+nz*.3+along.z*t*length*.85),r:angle,c:random(seed+i)>.5?'#d9d6cf':'#b9b5ad'});}
      });
      // Rooftop vents, antennas and the occasional wooden water tank.
      const roof=b.height+.1;
      for(let i=0;i<1+Math.floor(random(seed+40)*3);i++)vents.push({p:new THREE.Vector3(b.x+(random(seed+i*3)-.5)*b.w*.6,roof+.6,b.z+(random(seed+i*5)-.5)*b.d*.6),r:random(seed+i)*3,c:random(seed+i*9)>.5?'#8f9497':'#6f7477'});
      if(random(seed+50)>.55)antennas.push({p:new THREE.Vector3(b.x+(random(seed+51)-.5)*b.w*.5,roof+3,b.z+(random(seed+52)-.5)*b.d*.5)});
      if(!b.rowHouse && b.height<70 && random(seed+60)>.7)tanks.push({p:new THREE.Vector3(b.x+(random(seed+61)-.5)*b.w*.4,roof,b.z+(random(seed+62)-.5)*b.d*.4)});
    }
    const lit=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.8});
    const awningGeometry=new THREE.BoxGeometry(1,.12,1.8);
    batch(awningGeometry,lit,awnings);
    batch(new THREE.BoxGeometry(.75,.48,.6),lit.clone(),acUnits);
    batch(new THREE.BoxGeometry(2.2,1.2,1.6),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.6,metalness:.3}),vents);
    batch(new THREE.CylinderGeometry(.06,.1,6,6),new THREE.MeshStandardMaterial({color:0x55595c,metalness:.6,roughness:.4}),antennas);
    const tankGeometry=new THREE.CylinderGeometry(1.5,1.5,2.8,12);tankGeometry.translate(0,3.6,0);
    const tankRoofGeometry=new THREE.ConeGeometry(1.65,.9,12);tankRoofGeometry.translate(0,5.45,0);
    const tankLegGeometry=new THREE.BoxGeometry(2,2.2,2);tankLegGeometry.translate(0,1.1,0);
    batch(tankGeometry,new THREE.MeshStandardMaterial({color:0x7a5f45,roughness:.9}),tanks);batch(tankRoofGeometry,new THREE.MeshStandardMaterial({color:0x4d5459,roughness:.8}),tanks);
    batch(tankLegGeometry,new THREE.MeshStandardMaterial({color:0x3a3e41,roughness:.7,wireframe:true}),tanks);
    // Corner props: newspaper boxes, mailboxes and piles of trash bags.
    const newsBoxes=[],mailboxes=[],bags=[];
    const corners=[];
    for(let i=-5;i<=5;i++)for(let j=-16;j<=22;j++)corners.push([i*40,j*40]);
    for(let i=9;i<=19;i++)for(let j=11;j<=26;j++)corners.push([i*40,j*40]);
    for(const [x,z] of corners) {
      const seed=x*1.3+z*.7;
      if(inPark(x+8,z+8)||waterAt(x+8,z+8))continue;
      if(random(seed)>.5)for(let k=0;k<2+Math.floor(random(seed+1)*2);k++)newsBoxes.push({p:new THREE.Vector3(x+5.9,.95,z+9+k*.75),c:['#c23a2e','#1f4f9a','#e0b84a','#2f6b4f','#f2f0ea'][Math.floor(random(seed+k*3)*5)]});
      if(random(seed+5)>.7)mailboxes.push({p:new THREE.Vector3(x+9,1.05,z+5.9),c:'#1f4f9a'});
      if(random(seed+9)>.6)for(let k=0;k<2+Math.floor(random(seed+10)*4);k++)bags.push({p:new THREE.Vector3(x+5.9+random(seed+k)*.6,.75,z+20+random(seed+k*2)*2.5),s:new THREE.Vector3(.9,.8+random(seed+k*5)*.4,.9),c:k%3?'#16181a':'#2a2d30'});
    }
    batch(new THREE.BoxGeometry(.5,1.05,.55),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.5}),newsBoxes);
    const mailGeometry=new THREE.CylinderGeometry(.32,.32,.6,12,1,false,0,Math.PI);mailGeometry.rotateZ(Math.PI/2);
    batch(new THREE.BoxGeometry(.6,1.1,.6),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.5}),mailboxes);
    batch(new THREE.SphereGeometry(.42,10,8),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.25,metalness:.1}),bags);
    // Rooftop billboards add color to the skyline.
    const ads=[['NEW YORK','The city that never naps',['#c23a2e','#3a0b10']],['BAGELS','Since forever',['#e0a23a','#5a2e06']],['THE DAILY BUGLE','Pictures of Spider-Man wanted',['#20262c','#0b0d10']],['BROADWAY','Tonight only. Probably.',['#6b2bd1','#1b0b33']],['YELLOW CAB','Hail yes',['#e8c33a','#4a3a06']],['PIZZA','$1 a slice. Ask why.',['#2f8a3e','#0a2610']]];
    const tall=buildings.filter(b=>!b.landmark && !b.shape && b.height>45 && b.height<120).sort((m,n)=>random(m.x+n.z)-random(n.x+m.z)).slice(0,14);
    tall.forEach((b,i)=>{
      const [title,line,colors]=ads[i%ads.length],board=new THREE.Group();board.position.set(b.x,b.height+.2,b.z);board.rotation.y=Math.floor(random(b.x)*4)*Math.PI/2;
      const frame=new THREE.Mesh(new THREE.BoxGeometry(12.4,6.6,.4),new THREE.MeshStandardMaterial({color:0x2b2f33,metalness:.5,roughness:.5}));frame.position.y=5.6;board.add(frame);
      for(const x of [-4.5,4.5]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.3,2.4,.3),frame.material);leg.position.set(x,1.2,0);board.add(leg);}
      const face=new THREE.Mesh(new THREE.PlaneGeometry(12,6.2),new THREE.MeshBasicMaterial({map:billboardCanvas([title,line,''],colors),toneMapped:false}));face.position.set(0,5.6,.21);board.add(face);
      const back=face.clone();back.rotation.y=Math.PI;back.position.z=-.21;board.add(back);
      board.userData.skyline=true;scene.add(board);grappleMeshes.push(frame);
    });
  }
  // Pigeons gather in parks and plazas and scatter when you come close.
  const pigeonSpots=[[-20,0],[-40,-120],[0,120],[60,220],[20,540],[20,930],[-60,-160],[560,1060],[-110,-60],[140,140]];
  const pigeons=[];
  pigeonSpots.forEach(([x,z],s)=>{for(let i=0;i<12;i++){const a=random(s*31+i)*Math.PI*2,r=1+random(s*17+i)*4;pigeons.push({home:new THREE.Vector3(x+Math.cos(a)*r,inPark(x,z)?.15:.5,z+Math.sin(a)*r),pos:new THREE.Vector3(),vel:new THREE.Vector3(),flying:0,phase:random(s+i*3)*6,yaw:random(i)*6});}});
  const pigeonGeometry=(()=>{const b=new ToyKit.Builder();b.ellipsoid([0,.16,.08],[0,.18,-.12],.08,.07,'#7d8288',0,1.1);b.add(ToyKit.sphere(.055,8,6),'#5d6670',{p:[0,.26,-.14]});b.add(ToyKit.cone(.015,.05,4),'#c99a3c',{p:[0,.25,-.2],r:[-Math.PI/2,0,0]});return b.geometry();})();
  const pigeonMesh=new THREE.InstancedMesh(pigeonGeometry,ToyKit.toyMaterial,pigeons.length);pigeonMesh.frustumCulled=false;pigeonMesh.userData.projectile=true;pigeonMesh.raycast=()=>{};scene.add(pigeonMesh);
  pigeons.forEach(p=>p.pos.copy(p.home));
  const pigeonTransform=new THREE.Object3D();
  function updatePigeons(dt) {
    for(let i=0;i<pigeons.length;i++) {
      const p=pigeons[i];
      if(p.flying>0) {
        p.flying-=dt;p.vel.y+=dt*2;p.pos.addScaledVector(p.vel,dt);
        if(p.flying<=0)p.pos.copy(p.home);
      } else {
        const dx=p.pos.x-position.x,dz=p.pos.z-position.z;
        if(dx*dx+dz*dz<36 && Math.abs(p.pos.y-position.y)<3) {
          // Scatter away from the player, then return home much later.
          const away=Math.atan2(dx,dz)+(random(i+elapsed)-.5);p.vel.set(Math.sin(away)*7,6+random(i)*3,Math.cos(away)*7);p.flying=12;p.yaw=away+Math.PI;if(i%6===0)playEffect('bird',p.pos);
        }
      }
      const peck=p.flying>0?0:Math.max(0,Math.sin(elapsed*3+p.phase))*.5;
      pigeonTransform.position.copy(p.pos);pigeonTransform.rotation.set(p.flying>0?-.3:peck,p.yaw,0);pigeonTransform.updateMatrix();pigeonMesh.setMatrixAt(i,pigeonTransform.matrix);
    }
    pigeonMesh.instanceMatrix.needsUpdate=true;
  }
  // Distance LOD: city chunks beyond the detail radius move to a hidden layer and
  // their towers are drawn by a few instanced stand-ins, cutting draw calls sharply.
  const lodHiddenLayer=3,lodNear=250,lodCell=120,lodChunks=new Map(),lodProxies=[];
  {
    const dynamic=new Set([...cruisers.map(c=>c.group),policeHeli.group,policeHeli.beam,sky,anchorMarker,particleSystem,wadeRipple,sun,sun.target,fill,rhino.group,hero.root,distantTrunks,distantCanopies,roadMarks,
      ...webLines,...cars.map(a=>a.group),...pedestrians.map(a=>a.group),...dogs.flatMap(d=>[d.group,d.leash]),...helicopters.map(h=>h.group),...birds.map(b=>b.group),
      ...harborBoats,...highAircraft.map(a=>a.group),...villains.map(v=>v.group),...chargeProps.map(p=>p.group)]);
    const bounds=new THREE.Box3(),center=new THREE.Vector3(),size=new THREE.Vector3();
    for(const object of scene.children) {
      if(dynamic.has(object) || object.isLight || object.userData.actor || object.userData.projectile)continue;
      bounds.setFromObject(object);if(bounds.isEmpty())continue;
      bounds.getCenter(center);bounds.getSize(size);
      if(Math.max(size.x,size.z)>150 || object.userData.skyline || bounds.max.y>120)continue;
      // Street furniture disappears much sooner than buildings do.
      const small=Math.max(size.x,size.y,size.z)<9,cell=small?60:lodCell;
      const key=`${small?'s':'b'}${Math.floor(center.x/cell)},${Math.floor(center.z/cell)}`;
      if(!lodChunks.has(key))lodChunks.set(key,{x:(Math.floor(center.x/cell)+.5)*cell,z:(Math.floor(center.z/cell)+.5)*cell,objects:[],near:true,small});
      lodChunks.get(key).objects.push(object);
    }
    // Stand-ins reuse the real facade materials, so the far skyline matches.
    const proxyGroups=new Map(),unitBox=new THREE.BoxGeometry(1,1,1);
    for(const mesh of grappleMeshes) {
      if(!mesh.isMesh || mesh.isInstancedMesh || !buildingMats.includes(mesh.material) && mesh.material!==mats.roof)continue;
      const type=mesh.geometry.type==='BoxGeometry'?'box':mesh.geometry===roundTowerGeometry?'round':mesh.geometry===diamondTowerGeometry?'diamond':mesh.geometry===octagonalTowerGeometry?'octagon':null;
      if(!type)continue;
      mesh.updateWorldMatrix(true,false);bounds.setFromObject(mesh);bounds.getCenter(center);if(bounds.max.y>120 || mesh.userData.skyline)continue;
      const chunk=lodChunks.get(`b${Math.floor(center.x/lodCell)},${Math.floor(center.z/lodCell)}`);if(!chunk)continue;
      const key=`${type}:${mesh.material.id}`;
      if(!proxyGroups.has(key))proxyGroups.set(key,{type,material:mesh.material,items:[]});
      const matrix=type==='box'?new THREE.Matrix4().compose(center.clone(),mesh.getWorldQuaternion(new THREE.Quaternion()),bounds.getSize(new THREE.Vector3())):mesh.matrixWorld.clone();
      proxyGroups.get(key).items.push({mesh,chunk,matrix});
    }
    for(const {type,material,items} of proxyGroups.values()) {
      const geometry=type==='box'?unitBox:type==='round'?roundTowerGeometry:type==='diamond'?diamondTowerGeometry:octagonalTowerGeometry;
      const batch=new THREE.InstancedMesh(geometry,material,items.length);batch.frustumCulled=false;batch.raycast=()=>{};batch.userData.projectile=true;scene.add(batch);
      items.forEach((item,index)=>{item.batch=batch;item.index=index;batch.setMatrixAt(index,hiddenDetail);lodProxies.push(item);});
    }
  }
  let lodTimer=0;
  function updateCityLod(dt,force=false) {
    lodTimer-=dt;if(lodTimer>0 && !force)return;lodTimer=.25;
    const range=lodNear*graphicsProfiles[graphicsQuality].detail+Math.min(position.y,120)*.8;let changed=false;
    for(const chunk of lodChunks.values()) {
      const near=Math.hypot(chunk.x-position.x,chunk.z-position.z)<(chunk.small?100*graphicsProfiles[graphicsQuality].detail:range);
      if(near===chunk.near && !force)continue;
      chunk.near=near;changed=true;
      for(const object of chunk.objects)object.traverse(child=>{if(near)child.layers.enable(0);else child.layers.set(lodHiddenLayer);});
    }
    // Knockable props move, so they are culled by their own current position.
    for(const prop of chargeProps) {
      const p=prop.group.position,near=Boolean(prop.knockback || prop.webHeld || prop.webPinned || prop.webTether || cityEvent?.actor===prop) || (p.x-position.x)**2+(p.z-position.z)**2<(115*graphicsProfiles[graphicsQuality].detail)**2;
      if(near===prop.lodNear)continue;
      prop.lodNear=near;prop.group.traverse(child=>{if(near)child.layers.enable(0);else child.layers.set(lodHiddenLayer);});
    }
    const touched=new Set();
    for(const proxy of lodProxies) {
      const show=!proxy.chunk.near && proxy.mesh.visible && !proxy.mesh.userData.structure?.destroyed;
      if(show===proxy.shown)continue;
      proxy.shown=show;proxy.batch.setMatrixAt(proxy.index,show?proxy.matrix:hiddenDetail);touched.add(proxy.batch);
    }
    for(const batch of touched)batch.instanceMatrix.needsUpdate=true;
    return changed;
  }
