  // Times Square: giant glowing billboards with ads nobody asked for.
  const timesSquareScreens=[];
  function billboardCanvas(lines,colors) {
    const image=document.createElement('canvas');image.width=512;image.height=320;const c=image.getContext('2d');
    const grad=c.createLinearGradient(0,0,512,320);grad.addColorStop(0,colors[0]);grad.addColorStop(1,colors[1]);c.fillStyle=grad;c.fillRect(0,0,512,320);
    c.textAlign='center';c.fillStyle='#fff';c.shadowColor='rgba(0,0,0,.5)';c.shadowBlur=8;
    c.font='900 64px Arial Black, Arial';c.fillText(lines[0],256,120);c.font='bold 30px Arial';c.fillText(lines[1],256,185);c.font='bold 24px Arial';c.fillStyle='#ffe98a';c.fillText(lines[2]||'',256,250);
    const texture=new THREE.CanvasTexture(image);texture.colorSpace=THREE.SRGBColorSpace;return texture;
  }
  const newsTicker={canvas:document.createElement('canvas'),texture:null,text:'WELCOME TO NEW YORK  •  LIVE FROM TIMES SQUARE  •  ',offset:0};
  newsTicker.canvas.width=2048;newsTicker.canvas.height=64;newsTicker.texture=new THREE.CanvasTexture(newsTicker.canvas);newsTicker.texture.colorSpace=THREE.SRGBColorSpace;
  newsTicker.texture.wrapS=THREE.RepeatWrapping;
  function setNews(text) {
    newsTicker.text=`${text}  •  `;const c=newsTicker.canvas.getContext('2d');
    c.fillStyle='#0b0b12';c.fillRect(0,0,2048,64);c.fillStyle='#ff4747';c.font='900 40px Arial';c.textBaseline='middle';
    let x=10;while(x<2048){c.fillText(newsTicker.text,x,34);x+=c.measureText(newsTicker.text).width;}newsTicker.texture.needsUpdate=true;
  }
  setNews('LIVE FROM TIMES SQUARE  •  NEW YORK CITY');
  function makeTimesSquare() {
    const ads=[[['NEW YORK','LIVE NEWS','TIMES SQUARE'],['#b3122b','#2a0b14']],[['CITY LIGHTS','OPEN LATE','MIDTOWN'],['#1d5bd8','#0b1638']],
      [['BROADWAY','NOW PLAYING','THEATER DISTRICT'],['#7a2bd1','#1b0b33']],[['HOT DOGS','FRESH DAILY','NEW YORK'],['#f2a22a','#5a2a06']],
      [['I ♥ NY','EXPLORE','THE CITY'],['#ffffff','#d8263a']],[['NEW YEAR\'S EVE','TIMES SQUARE','NEW YORK'],['#18a07d','#062b22']]];
    const placements=[[-15,-14,0,32],[15,-14,0,40],[-15,14,Math.PI,28],[15,14,Math.PI,36],[-15,0,Math.PI/2,46],[15,0,-Math.PI/2,24]];
    placements.forEach(([dx,dz,angle,height],i)=>{
      const sign=new THREE.Group();sign.position.set(60+dx*1.05,0,220+dz*1.05);sign.rotation.y=angle;scene.add(sign);
      const pole=box(.9,height,.9,metal,0,height/2,0,sign);grappleMeshes.push(pole);
      const frameMesh=box(14.6,9.4,.6,metal,0,height+3.5,-.35,sign);grappleMeshes.push(frameMesh);
      const texture=billboardCanvas(...ads[i]);const screen=new THREE.Mesh(new THREE.PlaneGeometry(14,9),new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));
      screen.position.set(0,height+3.5,.02);sign.add(screen);timesSquareScreens.push(screen);
      const back=new THREE.Mesh(screen.geometry,new THREE.MeshBasicMaterial({map:billboardCanvas(...ads[(i+3)%ads.length]),toneMapped:false}));back.position.set(0,height+3.5,-.72);back.rotation.y=Math.PI;sign.add(back);
    });
    const ticker=new THREE.Mesh(new THREE.CylinderGeometry(9,9,3,48,1,true),new THREE.MeshBasicMaterial({map:newsTicker.texture,toneMapped:false}));
    ticker.position.set(60,20,220);newsTicker.texture.repeat.set(2,1);scene.add(ticker);newsTicker.mesh=ticker;
    const ball=new THREE.Mesh(new THREE.IcosahedronGeometry(2.2,1),new THREE.MeshStandardMaterial({color:0xe8f4ff,metalness:.9,roughness:.15,emissive:0x3355aa,emissiveIntensity:.4}));
    ball.position.set(60,52,220);scene.add(ball);box(.4,16,.4,metal,60,42,220);grappleMeshes.push(ball);newsTicker.ball=ball;
  }
  const skylineStart=scene.children.length;
  makeBrooklynBridge();const liberty=makeStatueOfLiberty();makeConeyIsland();makeTimesSquare();
  // Landmarks stay drawn at any distance; they are how you find your way.
  for(const object of scene.children.slice(skylineStart))if(!object.userData.actor)object.userData.skyline=true;
  makeBatteryPark();
  function updateLandmarks(dt) {
    if(wonderWheel.rim){wonderWheel.rim.rotation.z+=dt*.12;for(const car of wonderWheel.cars)car.rotation.z=-wonderWheel.rim.rotation.z;}
    newsTicker.texture.offset.x=(newsTicker.texture.offset.x+dt*.05)%1;
    waterNormals.offset.set((elapsed*.004)%1,(elapsed*.0025)%1);
    if(newsTicker.ball)newsTicker.ball.rotation.y+=dt*.8;
    liberty.userData.flame.scale.set(1+.08*Math.sin(elapsed*13),1+.15*Math.sin(elapsed*9),1);
  }
  function rooftopRest(person) {
    if(person.rooftopKind==='view') {poseSittingLegs(person,1.25);person.leftArm.rotation.x=.15;person.rightArm.rotation.x=.15;}
  }
  function addRooftopScenes() {
    const candidates=buildings.filter(b=>b.height>28);
    for(let i=0;i<12 && i<candidates.length;i++) {
      const b=candidates[(i*11)%candidates.length],blockX=b.x-20,blockZ=b.z-20;
      if(i%2===0) {
        const height=Math.max(12,b.height*.63),z=b.z-b.d/2-1.05;
        const platform=new THREE.Group();platform.position.set(b.x,height,z);platform.userData.targetable=true;scene.add(platform);
        box(3.2,.18,1.1,metalTrim,0,0,0,platform);box(3.2,.09,.09,metalTrim,0,1,-.48,platform);
        const cables=[];
        for(const side of [-1,1]){box(.09,1,.09,metalTrim,side*1.5,.5,-.48,platform);cables.push(beamBetween(platform,[side*1.4,0,0],[side*1.4,b.height-height,0],.025,cableMat));}
        const worker=makePedestrian(b.x,z,1700+i,blockX,blockZ,'worker');worker.group.position.y=height+.1;worker.group.rotation.y=Math.PI;
        worker.settled=true;worker.rooftop=true;worker.rooftopKind='washer';
        oval(worker.head,mustard,0,.2,0,.16,.055,.15);
        box(.055,.58,.055,metalTrim,0,-.65,-.13,worker.rightArm);box(.32,.06,.07,metalTrim,0,-.96,-.13,worker.rightArm);
        if(!b.washers)b.washers=[];b.washers.push({platform,worker,cables,origin:platform.position.clone(),roof:b.height,fall:null});
      } else {
        const viewer=makePedestrian(b.x+b.w/2-.65,b.z,1800+i,blockX,blockZ);
        viewer.group.position.y=b.height-.55;viewer.group.rotation.y=-Math.PI/2;
        viewer.settled=true;viewer.rooftop=true;viewer.rooftopKind='view';rooftopRest(viewer);
      }
    }
  }
  addRooftopScenes();
  // Small destination scenes make the park, plazas and rooftops worth exploring.
  function makeNeighborhoodScenes() {
    const canopyMats=[roleRed,roleAccent,roleCloth.courier,roleCloth.jogger];
    const stringLightMat=new THREE.MeshStandardMaterial({color:0xffdfa1,emissive:0xffa948,emissiveIntensity:.65});
    const stringLightGeometry=new THREE.SphereGeometry(.105,8,6);
    const speakerConeGeometry=new THREE.CircleGeometry(.23,16);
    for(const [cx,cz] of [[51,229],[20,550],[505,1081]]) {
      const market=new THREE.Group();market.position.set(cx,.12,cz);market.userData.interestKind='market';market.userData.targetable=true;scene.add(market);
      for(let i=0;i<3;i++) {
        const x=(i-1)*4.2;
        box(3.5,.8,1.2,woodMat,x,.65,0,market);box(3.7,.12,1.35,stone,x,1.1,0,market);
        for(const side of [-1,1])box(.1,2.2,.1,metalTrim,x+side*1.6,1.7,.5,market);
        box(3.9,.16,1.8,canopyMats[i],x,2.85,0,market);
        for(let stripe=-2;stripe<=2;stripe++)box(.32,.02,1.79,roleLight,x+stripe*.76,2.94,0,market);
        for(const side of [-1,1]) {
          box(.72,.45,.58,woodMat,x+side*1.2,.23,-1.0,market);
          for(let fruit=0;fruit<3;fruit++)oval(market,[roleRed,roleAccent,foliage][(fruit+i)%3],x+side*1.2+(fruit-1)*.2,.51,-1.0,.12,.1,.12);
        }
        for(let k=0;k<4;k++)oval(market,[roleRed,roleAccent,foliage][(i+k)%3],x-1.1+k*.68,1.25,0,.16,.15,.16);
        const vendor=makePedestrian(cx+x,cz+.9,12000+i+cx,Math.floor(cx/40)*40,Math.floor(cz/40)*40,'vendor');
        vendor.settled=true;vendor.vendor=true;vendor.group.position.y=.12;
        playerBuildingColliders.push({x:cx+x,z:cz,w:3.5,d:1.2,height:1.05});
      }
      plazaVisitors(cx,cz-4,6,2.5,5,12100+cx);
      for(const npc of pedestrians.slice(-5))npc.group.position.y=.12;
    }
    for(const [index,[x,z]] of [[-15,-15],[-48,-29],[11,31],[-54,93],[12,141]].entries()) {
      if(waterAt(x,z))continue;
      const y=.12+parkElevation(x,z),rug=box(4.5,.04,3,canopyMats[index%canopyMats.length],x,y,z);rug.receiveShadow=true;
      for(let k=-1;k<=1;k++)box(.08,.02,3,roleLight,x+k*1.2,y+.03,z);
      for(let i=0;i<3;i++) {
        const angle=i*Math.PI*2/3,person=makePedestrian(x+Math.cos(angle)*2.6,z+Math.sin(angle)*2.1,12200+index*7+i,-40,-40,i===0?'performer':null);
        person.group.position.y=y;person.group.rotation.y=angle+Math.PI/2;person.settled=true;person.rooftopKind='party';
      }
      box(.65,.3,.45,woodMat,x,y+.2,z);oval(scene,roleAccent,x+.15,y+.42,z,.12,.11,.12);
    }
    const districts=['midtown','village','fidi','brooklyn'];
    for(let index=0;index<districts.length;index++) {
      const choices=buildings.filter(b=>b.parts && !b.landmark && !b.shape && ![2,3,5,7].includes(b.style) && b.w>16 && b.d>16 && b.height>14 && districtAt(b.x,b.z)===districts[index]);
      if(!choices.length)continue;
      const b=choices[Math.floor(choices.length*.55)],px=b.x+b.w*.27,pz=b.z+b.d*.23,party=new THREE.Group();party.position.set(px,b.height,pz);party.userData.structure=b;party.userData.interestKind='rooftop-party';scene.add(party);b.parts.push(party);
      box(6.4,.035,4.5,canopyMats[index%canopyMats.length],0,.025,0,party);
      for(let stripe=-2;stripe<=2;stripe++)box(.06,.015,4.45,roleLight,stripe*1.1,.05,0,party);
      box(3,.12,1.2,woodMat,0,.8,0,party);for(const side of [-1,1])box(.12,.8,.12,metalTrim,side*1.2,.4,0,party);
      box(.8,1.2,.65,roleDark,-3,.6,-2,party);box(.8,1.2,.65,roleDark,3,.6,-2,party);
      for(const side of [-1,1]) {
        for(const sy of [.42,.85]){const cone=new THREE.Mesh(speakerConeGeometry,metalTrim);cone.position.set(side*3,sy,-1.665);party.add(cone);}
        box(.08,3,.08,metalTrim,side*3.6,1.5,2.2,party);
      }
      beamBetween(party,[-3.6,3,2.2],[3.6,3,2.2],.025,cableMat);
      for(let light=-3;light<=3;light++){const bulb=new THREE.Mesh(stringLightGeometry,stringLightMat);bulb.position.set(light,2.91,2.2);party.add(bulb);}
      for(let cup=-1;cup<=1;cup++)box(.16,.22,.16,[roleRed,roleLight,roleAccent][cup+1],cup*.65,.97,0,party);
      for(let i=0;i<5;i++) {
        const angle=i*Math.PI*2/5,npc=makePedestrian(px+Math.cos(angle)*2.6,pz+Math.sin(angle)*2.1,12400+index*17+i,b.x-20,b.z-20,i===0?'performer':null);
        npc.group.position.y=b.height;npc.group.rotation.y=-angle+Math.PI/2;npc.settled=true;npc.rooftop=true;npc.rooftopKind='party';
      }
    }
    const build=buildings.find(b=>b.parts && !b.landmark && !b.shape && b.w>16 && b.height>30 && districtAt(b.x,b.z)==='midtown');
    if(build) {
      const x=build.x+build.w/2+2,z=build.z,scaffold=new THREE.Group();scaffold.position.set(x,0,z);scaffold.userData.structure=build;scaffold.userData.interestKind='scaffold';scene.add(scaffold);build.parts.push(scaffold);
      for(const dx of [-1.7,1.7])for(const dz of [-3,3])box(.12,15,.12,metalTrim,dx,7.5,dz,scaffold);
      for(let y=3;y<=15;y+=3) {
        box(3.5,.15,6.2,woodMat,0,y,0,scaffold);
        const platform={x,z,w:3.5,d:6.2,bottom:y-.3,height:y+.08,walkable:true,structure:build};playerBuildingColliders.push(platform);
        for(const dx of [-1.7,1.7])box(.08,.08,6,metalTrim,dx,y+1,0,scaffold);
      }
      scaffold.traverse(child=>{if(child.isMesh)grappleMeshes.push(child);});
      const worker=makePedestrian(x,z,12501,build.x-20,build.z-20,'worker');worker.group.position.y=15.1;worker.settled=true;worker.rooftop=true;worker.rooftopKind='washer';
    }
  }
  makeNeighborhoodScenes();
  // Play spaces are real physics objects: players, people and vehicles can use them.
  const bouncePads=[],pressureTanks=[];
  const padBaseMat=material(0x3f5054),padFabricMat=material(0xd85b4d),padRingMat=material(0xf4c65f);
  const tankBodyMat=material(0x477b83),tankBandMat=material(0xe8b85c);
  function makeBouncePad(x,z,y,owner=null) {
    const group=new THREE.Group();group.position.set(x,y,z);group.userData.interestKind='bounce-pad';group.userData.targetable=true;
    if(owner){group.userData.structure=owner;owner.parts.push(group);}scene.add(group);
    const base=new THREE.Mesh(new THREE.CylinderGeometry(2.15,2.15,.30,24),padBaseMat);base.position.y=.15;group.add(base);
    const bed=new THREE.Mesh(new THREE.CylinderGeometry(1.9,1.9,.16,24),padFabricMat);bed.position.y=.46;group.add(bed);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(2,.12,8,32),padRingMat);ring.rotation.x=Math.PI/2;ring.position.y=.48;group.add(ring);
    const cross=new THREE.Mesh(new THREE.RingGeometry(.28,.4,16),mats.white);cross.rotation.x=-Math.PI/2;cross.position.y=.55;group.add(cross);
    for(let i=0;i<8;i++){const angle=i*Math.PI/4;box(.17,.32,.17,roofTrim,Math.cos(angle)*1.7,.32,Math.sin(angle)*1.7,group);}
    const surface={x,z,w:4.2,d:4.2,bottom:y-.2,height:y+.43,walkable:true};if(owner)surface.structure=owner;playerBuildingColliders.push(surface);
    const pad={group,bed,ring,x,z,y,top:y+.43,radius:1.85,owner,compression:0};bouncePads.push(pad);return pad;
  }
  function makePressureTank(x,z,y) {
    const group=new THREE.Group();group.position.set(x,y,z);group.userData.interestKind='pressure-tank';scene.add(group);
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.46,.46,1.25,16),tankBodyMat);body.position.y=.69;group.add(body);
    for(const h of [.22,1.15]){const band=new THREE.Mesh(new THREE.TorusGeometry(.46,.06,6,16),tankBandMat);band.rotation.x=Math.PI/2;band.position.y=h;group.add(band);}
    const cap=new THREE.Mesh(new THREE.SphereGeometry(.25,12,8),tankBodyMat);cap.scale.y=.45;cap.position.y=1.32;group.add(cap);
    box(.3,.12,.12,roleRed,0,1.5,0,group);
    const actor=registerProp(group,.5,.5,1.6,'pressure-tank');actor.rearm=0;actor.fuse=0;pressureTanks.push(actor);return actor;
  }
  // A visible park pad introduces the idea; the others reward exploring the map.
  makeBouncePad(8,-30,.02);makeBouncePad(14,118,.02);makeBouncePad(299,24,.5);makeBouncePad(534,1080,.02);
  for(const district of ['midtown','village','fidi','brooklyn']) {
    const choices=buildings.filter(b=>b.parts&&!b.landmark&&!b.shape&&![2,3,5,7].includes(b.style)&&b.w>18&&b.d>17&&b.height>14&&districtAt(b.x,b.z)===district);
    if(!choices.length)continue;
    const b=choices[Math.floor(choices.length*.35)];makeBouncePad(b.x-b.w*.27,b.z+b.d*.23,b.height,b);
  }
  for(const [x,z,y] of [[14,-26,.12],[-55,93,.12],[56,230,.12],[210,70,.12],[293,31,.5],[523,1082,.12],[-75,-570,.15],[407,755,.45]])makePressureTank(x,z,y);
  const targetGalleries=[];
  const targetRed=new THREE.MeshBasicMaterial({color:0xd5433c,side:THREE.DoubleSide}),targetWhite=new THREE.MeshBasicMaterial({color:0xffeee0,side:THREE.DoubleSide}),targetGold=new THREE.MeshBasicMaterial({color:0xffd25e,side:THREE.DoubleSide});
  function makeTargetGallery(x,z,y,owner=null) {
    const group=new THREE.Group();group.position.set(x,y,z);group.userData.interestKind='target-gallery';group.userData.targetable=true;
    if(owner){group.userData.structure=owner;owner.parts.push(group);}scene.add(group);
    const gallery={group,x,z,y,owner,targets:[],resetIn:0,completed:0};
    for(let i=0;i<3;i++) {
      const dx=(i-1)*2.5,pivot=new THREE.Group();pivot.position.set(dx,2,0);group.add(pivot);
      box(.13,1.35,.13,roofTrim,dx,.675,0,group);
      const target={gallery,pivot,x:x+dx,z,y:y+2,lit:false};pivot.userData.galleryTarget=target;
      for(const [radius,mat,depth] of [[.78,targetWhite,0],[.58,targetRed,.01],[.38,targetWhite,.02],[.18,targetGold,.03]]) {
        const face=new THREE.Mesh(new THREE.CircleGeometry(radius,24),radius===.58||depth===.03?mat.clone():mat);face.position.z=depth;pivot.add(face);
        if(radius===.58)target.ring=face;
        if(depth===.03)target.center=face;
      }
      const lampMat=new THREE.MeshStandardMaterial({color:0x765b38,emissive:0x312311,emissiveIntensity:.5});
      const lamp=new THREE.Mesh(new THREE.SphereGeometry(.12,10,8),lampMat);lamp.position.set(0,.98,0);pivot.add(lamp);target.lamp=lamp;
      const post={x:x+dx,z,w:.28,d:.28,bottom:y,height:y+1.35};if(owner)post.structure=owner;playerBuildingColliders.push(post);
      gallery.targets.push(target);
    }
    targetGalleries.push(gallery);return gallery;
  }
  makeTargetGallery(-3,-23,.12);makeTargetGallery(650,1068,.4);
  {const roofPad=bouncePads.find(p=>p.owner);if(roofPad){const b=roofPad.owner;makeTargetGallery(b.x,b.z-b.d*.31,b.height,b);}}
  const heliPaint=new THREE.MeshStandardMaterial({color:0xd4d7d3,metalness:.3,roughness:.38});
  function makeHelicopter(phase,height,radius) {
    const group=new THREE.Group();group.userData.targetable=true;group.userData.grappleKind='helicopter';scene.add(group);
    oval(group,heliPaint,0,0,0,1.05,.88,2.1);oval(group,carGlass,0,.15,-1.3,.94,.61,.96);
    oval(group,lampMat,0,.69,.65,.48,.20,.75);
    for(const side of [-1,1]) {
      oval(group,carGlass,side*.96,.18,.40,.045,.38,.72);
      box(.04,.66,.06,heliPaint,side*1.0,.15,.35,group);
      box(.18,.09,.12,side<0?taillightMat:headlightMat,side*1.0,-.12,.4,group);
    }
    vehicleTrim(group,[[0,.13,-2.18,.06,.72,.04],[-.71,.20,-1.92,.045,.65,.035],[.71,.20,-1.92,.045,.65,.035],[-.83,-.32,-1.53,.04,.04,1.0],[.83,-.32,-1.53,.04,.04,1.0]]);
    box(.14,.72,1.8,heliPaint,0,1.0,.05,group);
    const tail=box(.27,.32,3.8,heliPaint,0,.1,3.25,group);tail.rotation.x=-.04;
    box(.12,1.15,.72,heliPaint,0,.65,4.95,group);box(1.7,.12,.34,heliPaint,0,.35,4.5,group);
    for(const side of [-1,1]) {
      box(.10,.10,4.3,lampMat,side*.78,-1.02,.15,group);
      beamBetween(group,[side*.78,-1.02,-.9],[side*.55,-.5,-.55],.055,lampMat);
      beamBetween(group,[side*.78,-1.02,1],[side*.55,-.5,.8],.055,lampMat);
    }
    box(.15,.6,.15,lampMat,0,1.08,0,group);
    const rotor=new THREE.Group();rotor.position.y=1.42;group.add(rotor);
    box(8,.045,.18,lampMat,0,0,0,rotor);box(.18,.045,8,lampMat,0,0,0,rotor);
    const tailRotor=new THREE.Group();tailRotor.position.set(.16,.5,4.9);group.add(tailRotor);
    box(.05,1.5,.1,lampMat,0,0,0,tailRotor);box(.05,.1,1.5,lampMat,0,0,0,tailRotor);
    group.traverse(child=>{if(child.isMesh && child.parent!==rotor && child.parent!==tailRotor)grappleMeshes.push(child);});
    const heli={group,rotor,tailRotor,phase,height,radius};helicopters.push(heli);
  }
  makeHelicopter(.3,78,115);makeHelicopter(3.1,96,175);
  // A ladder of slowly drifting aircraft makes higher altitudes reachable in stages.
  const highAircraft=[];
  const balloonCanvas=document.createElement('canvas');balloonCanvas.width=256;balloonCanvas.height=128;
  const balloonPaint=balloonCanvas.getContext('2d');
  for(let i=0;i<8;i++){balloonPaint.fillStyle=i%2?'#f1d9ac':'#ba4941';balloonPaint.fillRect(i*32,0,32,128);balloonPaint.fillStyle='rgba(51,39,37,.2)';balloonPaint.fillRect(i*32,0,2,128);}
  const balloonTexture=new THREE.CanvasTexture(balloonCanvas);balloonTexture.colorSpace=THREE.SRGBColorSpace;
  const balloonMaterial=new THREE.MeshStandardMaterial({map:balloonTexture,roughness:.8,side:THREE.DoubleSide});
  const balloonGeometry=new THREE.SphereGeometry(1,24,16);
  const airshipMaterial=new THREE.MeshStandardMaterial({color:0xc5d1cd,roughness:.45,metalness:.22});
  function makeHighAircraft(height,x,z,index) {
    const group=new THREE.Group();group.position.set(x,height,z);group.userData.targetable=true;
    group.userData.grappleKind=index%2?'airship':'balloon';scene.add(group);
    let propeller=null;
    if(index%2===0) {
      const envelope=new THREE.Mesh(balloonGeometry,balloonMaterial);envelope.scale.set(6.5,8,6.5);group.add(envelope);
      const collar=new THREE.Mesh(new THREE.CylinderGeometry(2.2,1.4,2.1,16),balloonMaterial);collar.position.y=-7;group.add(collar);
      box(2.8,1.6,2.2,awning,0,-11,0,group);box(2.95,.16,2.35,metalTrim,0,-10.25,0,group);
      for(const side of [-1,1])for(const depth of [-1,1])beamBetween(group,[side*1.05,-10.3,depth*.8],[side*2,-7.3,depth*1.5],.045,cableMat);
      const burner=new THREE.Mesh(new THREE.SphereGeometry(.33,12,8),new THREE.MeshBasicMaterial({color:0xffb45e}));burner.position.y=-9.7;group.add(burner);
    } else {
      oval(group,airshipMaterial,0,0,0,5,4,12);
      oval(group,carGlass,0,-3.3,-1.0,2.2,1.1,3.1);
      box(3.8,.25,4.8,heliPaint,0,-4.1,-1,group);
      for(const side of [-1,1]) {
        box(.12,2.2,4.2,airshipMaterial,side*3.5,.2,9.2,group);
        box(2.6,.12,3.5,airshipMaterial,side*2.3,0,9.5,group);
        box(.12,.16,1.8,metalTrim,side*2.2,-3.25,-1.2,group);
      }
      propeller=new THREE.Group();propeller.position.set(0,0,11.8);group.add(propeller);
      box(4.2,.18,.12,lampMat,0,0,0,propeller);box(.18,4.2,.12,lampMat,0,0,0,propeller);
    }
    group.traverse(child=>{if(child.isMesh && child.parent!==propeller)grappleMeshes.push(child);});
    highAircraft.push({group,propeller,x,z,height,phase:index*1.7});
  }
  for(let i=0;i<8;i++)makeHighAircraft(115+i*90,i%2?-35:35,-15,i);
  // Small flocks circle over the park, where they remain visible between buildings.
  const birds=[],birdMat=material(0x525453);
  const wingGeometry=new THREE.BufferGeometry();
  wingGeometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0, .9,0,.25, .55,0,-.5],3));
  wingGeometry.computeVertexNormals();
  const wingMat=new THREE.MeshStandardMaterial({color:0x626463,roughness:1,side:THREE.DoubleSide});
  for(const [centerZ,height] of [[-35,18],[45,24],[115,20]]) for(let i=0;i<4;i++) {
    const group=new THREE.Group();scene.add(group);
    oval(group,birdMat,0,0,0,.17,.15,.36);oval(group,birdMat,0,.05,-.3,.13,.12,.14);
    const wings=[];
    for(const side of [-1,1]) {
      const wing=new THREE.Group();wing.position.x=side*.12;group.add(wing);
      const mesh=new THREE.Mesh(wingGeometry,wingMat);mesh.scale.x=side;wing.add(mesh);wings.push(wing);
    }
    birds.push({group,wings,centerZ,height,phase:i*Math.PI/2,radius:12+i*1.3});
  }
  // Rhino's articulated armor uses the same lightweight geometry as the city actors.
  // Villains are built from the same smooth parts as the people, one merged mesh per joint.
  function villainPart(parent,build,metal=false) {
    const b=new ToyKit.Builder();build(b);const mesh=b.mesh(metal?ToyKit.metalMaterial:ToyKit.toyMaterial);parent.add(mesh);return mesh;
  }
  function makeRhino() {
    const group=new THREE.Group();group.position.set(0,0,-29);scene.add(group);
    const plate='#7b8488',dark='#454d52',light='#a3abae',horn='#ece3cc',skin='#c8987a';
    const body=new THREE.Group();body.position.y=2.45;group.add(body);
    villainPart(body,b=>{
      // A barrel chest of overlapping armor plates over a thick waist.
      b.lathe([[0,-.95],[.82,-.92],[.95,-.7],[.9,-.35],[1.08,.1],[1.18,.45],[1.05,.75],[.6,.92],[0,.95]],plate,{depth:.7});
      for(const y of [-.45,-.15,.15,.45])b.add(ToyKit.torus(.82,.05,6,28,Math.PI),dark,{p:[0,y,-.02],r:[0,0,0],s:[1.08,1,.85]});
      b.add(ToyKit.sphere(1,16,12),light,{p:[0,.2,-.55],s:[.62,.62,.28]});
      b.add(ToyKit.roundedBox(1.5,.22,.95,.1),dark,{p:[0,-.78,0]});
    },true);
    const head=new THREE.Group();head.position.set(0,.98,-.10);body.add(head);
    villainPart(head,b=>{
      // Rhino helmet with a long snout, a curved horn and a human face in the opening.
      b.add(ToyKit.sphere(1,18,14),plate,{s:[.62,.66,.64]});
      b.ellipsoid([0,-.1,-.2],[0,-.25,-.85],.36,.3,plate,0,1);
      b.add(ToyKit.sphere(1,14,10),skin,{p:[0,-.02,-.5],s:[.3,.24,.16]});
      for(const side of [-1,1]) {
        b.add(ToyKit.sphere(.05,10,8),'#1b1b20',{p:[side*.12,.03,-.62]});
        b.add(ToyKit.roundedBox(.14,.03,.04,.015),dark,{p:[side*.12,.11,-.62],r:[0,0,side*.3]});
        b.add(ToyKit.cone(.13,.32,10),plate,{p:[side*.42,.5,.08],r:[0,0,-side*.5]});
      }
      b.add(ToyKit.roundedBox(.18,.03,.05,.015),'#6b2f2f',{p:[0,-.13,-.6]});
      b.add(ToyKit.cone(.2,.9,14),horn,{p:[0,.12,-.98],r:[-.55,0,0]});
      b.add(ToyKit.cone(.1,.38,10),horn,{p:[0,.38,-.62],r:[-.3,0,0]});
    },true);
    const limbs=[];
    for(const side of [-1,1]) {
      const arm=new THREE.Group();arm.position.set(side*1.02,.5,0);body.add(arm);
      villainPart(arm,b=>{
        b.add(ToyKit.sphere(1,16,12),light,{p:[side*.2,-.05,0],s:[.6,.48,.58]});
        b.taper([side*.25,-.2,0],[side*.3,-.75,-.05],.42,.34,plate);
        b.add(ToyKit.sphere(.34,14,10),dark,{p:[side*.3,-.75,-.05]});
        b.taper([side*.3,-.75,-.05],[side*.3,-1.12,-.12],.34,.3,plate);
        b.add(ToyKit.sphere(1,14,10),dark,{p:[side*.3,-1.22,-.14],s:[.36,.3,.38]});
      },true);
      limbs.push(arm);
      const leg=new THREE.Group();leg.position.set(side*.52,1.52,0);group.add(leg);
      villainPart(leg,b=>{
        b.taper([0,0,0],[0,-.7,0],.46,.38,plate);
        b.add(ToyKit.sphere(.38,14,10),dark,{p:[0,-.7,0]});
        b.taper([0,-.7,0],[0,-1.15,-.05],.38,.34,plate);
        b.add(ToyKit.roundedBox(.62,.3,.85,.14),dark,{p:[0,-1.28,-.15]});
      },true);
      limbs.push(leg);
    }
    group.traverse(child=>{if(child.isMesh)child.castShadow=true;});
    const rhino={group,body,head,arms:[limbs[0],limbs[2]],legs:[limbs[1],limbs[3]],kind:'rhino',hx:1.3,hz:1.1,top:4.4,
      state:'roam',timer:0,webHits:0,stuck:false,webRemaining:0,direction:new THREE.Vector3(),hitActors:new Set()};
    group.userData.actor=rhino;return rhino;
  }
  const rhino=makeRhino();
  // The other villains share the existing web-hit system, but have distinct attacks.
  const villains=[], enemyProjectiles=[], enemyEffects=[];
  const villainShotGeometry=new THREE.SphereGeometry(1,12,8);
  const goblinBombMaterial=new THREE.MeshStandardMaterial({color:0xe5832e,emissive:0xb93b08,emissiveIntensity:1});
  const electroShotMaterial=new THREE.MeshBasicMaterial({color:0x96f7ff});
  const attackRingGeometry=new THREE.RingGeometry(.75,1,32);
  const bombFlashMaterial=new THREE.MeshBasicMaterial({color:0xffa043,transparent:true,opacity:.75,side:THREE.DoubleSide,depthWrite:false});
  const electricFlashMaterial=new THREE.MeshBasicMaterial({color:0x9ffaff,transparent:true,opacity:.75,side:THREE.DoubleSide,depthWrite:false});
  const villainLooks={
    goblin:{suit:'#5b2f86',accent:'#7da34a',dark:'#2d1f45',skin:'#8fb04f',boot:'#3b2a55',chest:.3,waist:.24},
    electro:{suit:'#2f8a3e',accent:'#f2c230',dark:'#1f5a2a',skin:'#e8b48a',boot:'#f2c230',chest:.38,waist:.3},
    octopus:{suit:'#4b5d3a',accent:'#6b5a43',dark:'#2f3a26',skin:'#d9a882',boot:'#3a2c22',chest:.5,waist:.5}
  };
  function makeVillain(kind,x,y,z) {
    const group=new THREE.Group();group.position.set(x,y,z);scene.add(group);
    const look=villainLooks[kind],goblin=kind==='goblin',electro=kind==='electro';
    const body=new THREE.Group();body.position.y=1.30;group.add(body);
    villainPart(body,b=>{
      b.lathe([[0,-.6],[look.waist*1.05,-.58],[look.waist*1.1,-.4],[look.waist,-.2],[look.chest*.95,.15],[look.chest,.38],[look.chest*.8,.55],[.12,.62],[0,.63]],look.suit,{depth:.66});
      b.add(ToyKit.roundedBox(look.waist*2.1,.12,look.waist*1.45,.05),look.accent,{p:[0,-.48,0]});
      b.ellipsoid([0,.55,0],[0,.75,0],.1,.1,look.skin,0,1);
      if(electro) {
        // Lightning chest emblem and zigzag trim.
        for(const [a,c,w] of [[[0,.45,-.27],[-.12,.15,-.29],.05],[[-.12,.15,-.29],[.08,.05,-.29],.05],[[.08,.05,-.29],[-.06,-.3,-.27],.05]])b.rod(a,c,w,look.accent);
        for(const side of [-1,1])b.rod([side*.32,.4,-.18],[side*.26,-.4,-.2],.04,look.accent);
      }
      if(goblin) {b.rod([.22,.45,-.2],[-.22,-.35,-.22],.035,'#6b4a2e');b.add(ToyKit.roundedBox(.3,.25,.16,.06),'#6b4a2e',{p:[.3,-.35,-.12]});}
      if(kind==='octopus') {
        for(const side of [-1,1]){b.rod([side*.18,.5,-.35],[side*.3,-.5,-.38],.05,look.accent);b.add(ToyKit.roundedBox(.36,.55,.3,.1),look.suit,{p:[side*.28,-.8,.08]});}
        b.add(ToyKit.roundedBox(.9,.46,.32,.12),'#9aa2a6',{p:[0,.15,.42]});
        for(const side of [-1,1])for(const yy of [.32,-.02])b.add(ToyKit.sphere(.1,10,8),'#6f7779',{p:[side*.42,yy,.48]});
      }
    });
    const head=new THREE.Group();head.position.y=.84;body.add(head);
    villainPart(head,b=>{
      b.add(ToyKit.sphere(1,20,16),look.skin,{p:[0,.04,0],s:[.19,.23,.21]});
      for(const side of [-1,1]) {
        b.add(ToyKit.sphere(.03,10,8),goblin?'#ffe14a':'#f4f1ea',{p:[side*.07,.07,-.185],s:[1.2,.8,.6]});
        b.add(ToyKit.sphere(.016,8,6),goblin?'#b31f1f':'#2a1e17',{p:[side*.07,.07,-.2]});
        b.add(ToyKit.roundedBox(.08,.016,.02,.008),goblin?'#2d1f45':'#3a2a20',{p:[side*.07,.12,-.19],r:[0,0,side*(goblin?.45:-.1)]});
      }
      b.add(ToyKit.sphere(.025,10,8),look.skin,{p:[0,.02,-.215],s:[.9,1.4,1.1]});
      if(goblin) {
        // Grinning goblin with pointed ears and a purple hood.
        b.add(ToyKit.sphere(.05,12,6),'#2a1420',{p:[0,-.07,-.17],s:[1.6,.5,.6]});
        for(let i=-2;i<=2;i++)b.add(ToyKit.cone(.012,.03,5),'#f4f1ea',{p:[i*.022,-.06,-.19],r:[Math.PI,0,0]});
        for(const side of [-1,1])b.add(ToyKit.cone(.05,.26,8),look.skin,{p:[side*.22,.1,.02],r:[0,0,-side*1.15]});
        b.add(ToyKit.cone(.25,.5,14),look.suit,{p:[0,.3,.06],r:[-.35,0,0]});
        b.add(ToyKit.sphere(.25,16,12),look.suit,{p:[0,.1,.05],s:[1,.9,1.05]});
      } else if(electro) {
        // A yellow star mask framing the face.
        b.add(ToyKit.sphere(.215,18,12),look.suit,{p:[0,.1,.02],s:[.92,.8,1.02]});
        b.add(ToyKit.roundedBox(.34,.07,.04,.02),look.accent,{p:[0,.08,-.19]});
        for(let i=0;i<7;i++){const a=i*Math.PI*2/7;b.add(ToyKit.cone(.045,.22,6),look.accent,{p:[Math.sin(a)*.21,.04+Math.cos(a)*.24,-.08],r:[0,0,-a]});}
        b.add(ToyKit.sphere(.04,12,6),'#7a3b3b',{p:[0,-.08,-.18],s:[1,.3,.4]});
      } else {
        // Bowl cut, round dark glasses and a scowl.
        b.add(ToyKit.sphere(.21,18,12),'#1e1a18',{p:[0,.1,.02],s:[.95,.75,1.04]});
        for(const side of [-1,1]){b.add(ToyKit.cylinder(.055,.055,.02,16),'#15171a',{p:[side*.075,.07,-.2],r:[Math.PI/2,0,0]});b.add(ToyKit.torus(.055,.01,6,16),'#8a9296',{p:[side*.075,.07,-.205]});}
        b.rod([-.02,.07,-.205],[.02,.07,-.205],.008,'#8a9296');
        b.add(ToyKit.sphere(.045,12,6),'#7a3b3b',{p:[0,-.09,-.17],s:[1,.3,.4]});
        b.add(ToyKit.sphere(.12,14,10),look.skin,{p:[0,-.08,-.04],s:[1.3,.9,1.1]});
      }
    });
    const arms=[],elbows=[],legs=[],knees=[];
    const shoulder=look.chest*.95,armR=goblin?.09:electro?.1:.13;
    for(const side of [-1,1]) {
      const arm=new THREE.Group();arm.position.set(side*shoulder,.35,0);body.add(arm);
      villainPart(arm,b=>{b.add(ToyKit.sphere(armR*1.25,14,10),look.suit,{p:[side*.04,0,0]});b.taper([side*.04,0,0],[side*.04,-.37,0],armR,armR*.82,look.suit,0,14);});
      const elbow=new THREE.Group();elbow.position.set(side*.04,-.37,0);arm.add(elbow);
      villainPart(elbow,b=>{
        b.add(ToyKit.sphere(armR*.82,12,8),look.suit);b.taper([0,0,0],[0,-.3,0],armR*.82,armR*.7,electro||goblin?look.accent:look.suit,0,14);
        b.add(ToyKit.sphere(1,12,10),electro||goblin?look.accent:look.skin,{p:[0,-.38,-.02],s:[armR*.85,armR*1.2,armR*.75]});
      });
      const leg=new THREE.Group();leg.position.set(side*(look.waist*.7),.78,0);group.add(leg);
      villainPart(leg,b=>{b.add(ToyKit.sphere(armR*1.3,14,10),look.suit,{s:[1,.8,1]});b.taper([0,0,0],[0,-.39,0],armR*1.3,armR*.95,kind==='octopus'?look.accent:look.suit,0,14);});
      const knee=new THREE.Group();knee.position.y=-.39;leg.add(knee);
      villainPart(knee,b=>{b.add(ToyKit.sphere(armR*.95,12,8),kind==='octopus'?look.accent:look.suit);b.taper([0,0,0],[0,-.3,0],armR*.95,armR*.75,look.boot,0,14);b.add(ToyKit.roundedBox(armR*2.1,.14,goblin?.4:.34,.06),look.boot,{p:[0,-.34,-.07]});});
      arms.push(arm);elbows.push(elbow);legs.push(leg);knees.push(knee);
    }
    const limbs=[];let glow=null,glider=null;
    if(goblin) {
      glider=new THREE.Group();glider.position.y=.06;group.add(glider);
      const wingShape=new THREE.Shape();wingShape.moveTo(-3.3,.35);wingShape.lineTo(-1.2,-1.05);wingShape.lineTo(-.5,-.8);wingShape.lineTo(0,-1.7);wingShape.lineTo(.5,-.8);wingShape.lineTo(1.2,-1.05);wingShape.lineTo(3.3,.35);wingShape.lineTo(.8,.7);wingShape.lineTo(0,1.2);wingShape.lineTo(-.8,.7);wingShape.closePath();
      const wingGeometry=new THREE.ExtrudeGeometry(wingShape,{depth:.16,bevelEnabled:true,bevelSize:.06,bevelThickness:.04,bevelSegments:2});
      villainPart(glider,b=>{
        b.add(wingGeometry,'#3f5a2a',{r:[-Math.PI/2,0,0]});
        b.add(ToyKit.roundedBox(1.2,.25,1.9,.1),'#2d1f45',{p:[0,.14,0]});
        for(const side of [-1,1]){b.add(ToyKit.cylinder(.16,.22,.6,12),'#5b6366',{p:[side*.58,.08,.95],r:[Math.PI/2,0,0]});b.add(ToyKit.roundedBox(.12,.4,1.1,.05),'#2d1f45',{p:[side*1.25,.26,.1],r:[0,0,side*.35]});}
      },true);
      for(const side of [-1,1]){const flame=new THREE.Mesh(villainShotGeometry,goblinBombMaterial);flame.position.set(side*.58,.08,1.3);flame.scale.set(.14,.14,.28);glider.add(flame);}
    } else if(electro) {
      glow=new THREE.Mesh(villainShotGeometry,electroShotMaterial);glow.position.set(0,.3,-.3);glow.scale.set(.09,.12,.02);body.add(glow);
    } else {
      // Four mechanical arms sprout from the back harness.
      for(const side of [-1,1])for(const upper of [-1,1]) {
        const base=new THREE.Group();base.position.set(side*.58,upper>0?1.75:1.1,.42);group.add(base);
        base.rotation.y=-side*1.25;base.rotation.x=upper>0?.55:-.2;
        let joint=base;const joints=[base];
        for(let k=0;k<3;k++) {
          villainPart(joint,b=>{
            b.add(ToyKit.sphere(.19,14,10),'#5b6366');
            b.taper([0,0,0],[0,0,-1.8],.15,.12,'#9aa2a6',0,12);
            for(const z0 of [-.45,-.9,-1.35])b.add(ToyKit.torus(.15,.035,6,16),'#4a5154',{p:[0,0,z0]});
          },true);
          const next=new THREE.Group();next.position.z=-1.8;joint.add(next);joint=next;joints.push(next);
        }
        joints.claws=[];
        for(const clawSide of [-1,1]){const claw=new THREE.Group();claw.position.x=clawSide*.14;joint.add(claw);villainPart(claw,b=>{b.taper([0,0,0],[0,0,-.4],.07,.05,'#9aa2a6',0,10);b.add(ToyKit.cone(.06,.25,10),'#c94a3a',{p:[0,0,-.52],r:[-Math.PI/2,0,0]});},true);claw.rotation.y=clawSide*.5;joints.claws.push(claw);}
        limbs.push(joints);
      }
    }
    group.traverse(child=>{if(child.isMesh)child.castShadow=true;});
    const actor={kind,group,body,head,limbs,arms,elbows,legs,knees,glider,glow,spawn:new THREE.Vector3(x,y,z),state:'idle',timer:0,webHits:0,stuck:false,webRemaining:0,hx:.7,hz:.7,top:2.6};
    group.userData.actor=actor;villains.push(actor);return actor;
  }
  makeVillain('goblin',100,72,340);makeVillain('electro',80,0,232);makeVillain('octopus',40,0,800);
  // A separate foreground scene keeps the hands visible even close to a wall.
  const handsScene = new THREE.Scene();
  const handsCamera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .03, 20);
  handsScene.add(new THREE.HemisphereLight(0xe4efff, 0x45404a, 2.1));
  const handLight = new THREE.DirectionalLight(0xffddc5, 2.4); handLight.position.set(-2, 4, 3); handsScene.add(handLight);
  // CC0 WRAD ARMS: a real paired first-person mesh, split at the center for posing.
  const gloveMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.72,metalness:.04});
