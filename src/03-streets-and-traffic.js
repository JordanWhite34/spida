  // A single instanced contact-shadow pass grounds buildings against the pavement.
  {
    const image=document.createElement('canvas');image.width=image.height=128;const c=image.getContext('2d');
    const g=c.createRadialGradient(64,64,26,64,64,64);g.addColorStop(0,'rgba(28,34,36,.36)');g.addColorStop(.65,'rgba(28,34,36,.20)');g.addColorStop(1,'rgba(28,34,36,0)');
    c.fillStyle=g;c.fillRect(0,0,128,128);const texture=new THREE.CanvasTexture(image);texture.colorSpace=THREE.SRGBColorSpace;
    const owners=buildings.filter(b=>b.parts&&!b.suburb && b.w>6 && b.d>6),geometry=new THREE.PlaneGeometry(1,1);geometry.rotateX(-Math.PI/2);
    const shadows=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}),owners.length);
    shadows.userData.projectile=true;shadows.frustumCulled=false;const transform=new THREE.Object3D();
    owners.forEach((b,i)=>{transform.position.set(b.x,.46,b.z);transform.scale.set(b.w+8,1,b.d+8);transform.updateMatrix();shadows.setMatrixAt(i,transform.matrix);b.instanceParts.push({batch:shadows,index:i,matrix:transform.matrix.clone()});});
    scene.add(shadows);
  }
  // Static building trim and sidewalks share meshes by material and city block.
  // Keep grapple surfaces and named scene objects independent for interactions.
  function batchBuildingDetails() {
    const groups=new Map(),excluded=new Set(grappleMeshes);
    for(const mesh of scene.children) {
      if(!mesh.visible || !mesh.isMesh || mesh.isInstancedMesh || mesh.geometry?.type!=='BoxGeometry' || Array.isArray(mesh.material) ||
         mesh.material===mats.road || excluded.has(mesh) || Object.keys(mesh.userData).some(key=>key!=='structure') || mesh.children.length ||
         mesh.rotation.x || mesh.rotation.y || mesh.rotation.z)continue;
      const key=[mesh.material.id,Number(mesh.castShadow),Number(mesh.receiveShadow),Math.floor(mesh.position.x/80),Math.floor(mesh.position.z/80)].join(':');
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);
    }
    const transform=new THREE.Object3D();
    for(const meshes of groups.values()) {
      if(meshes.length<2)continue;
      const first=meshes[0],batch=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),first.material,meshes.length);
      batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;batch.userData.structures=[];
      meshes.forEach((mesh,i)=>{
        const size=mesh.geometry.parameters;
        transform.position.copy(mesh.position);transform.quaternion.copy(mesh.quaternion);
        transform.scale.set(size.width*mesh.scale.x,size.height*mesh.scale.y,size.depth*mesh.scale.z);transform.updateMatrix();
        batch.setMatrixAt(i,transform.matrix);
        const structure=mesh.userData.structure;if(structure){batch.userData.structures[i]=structure;structure.instanceParts.push({batch,index:i,matrix:transform.matrix.clone()});}
        scene.remove(mesh);mesh.geometry.dispose();
      });
      batch.computeBoundingSphere();scene.add(batch);
    }
  }
  batchBuildingDetails();
  // Road markings share one draw call instead of thousands of separate meshes.
  const markMatrices=[],markTransform=new THREE.Object3D();
  function roadMark(x,z,alongZ) {markTransform.position.set(x,.025,z);markTransform.scale.set(alongZ?.14:2.7,.025,alongZ?2.7:.14);markTransform.updateMatrix();markMatrices.push(markTransform.matrix.clone());}
  const offGrid=v=>Math.abs(v-Math.round(v/40)*40)>7;
  for(const [minX,maxX,minZ,maxZ] of [[-240,240,manhattanMinZ+20,940],[360,760,brooklyn.minZ+24,1060]]) {
    for(let x=minX;x<=maxX;x+=40)for(let z=minZ;z<=maxZ;z+=10)if(offGrid(z) && !joinedBlock(x,z) && !nearCurvedRoad(x,z,9) && !inPark(x,z))roadMark(x,z,true);
    for(let z=Math.ceil(minZ/40)*40;z<=maxZ;z+=40)for(let x=minX-20;x<=maxX+20;x+=10)if(offGrid(x) && !nearCurvedRoad(x,z,9) && !inPark(x,z))roadMark(x,z,false);
  }
  // Zebra crossings make intersections legible from both street level and the air.
  for(const [minX,maxX,minZ,maxZ] of [[-240,240,-680,960],[360,760,440,1040]])for(let x=minX;x<=maxX;x+=40)for(let z=minZ;z<=maxZ;z+=40) {
    if(inPark(x,z)||waterAt(x,z)||nearCurvedRoad(x,z,8)||joinedBlock(x,z))continue;
    for(const side of [-1,1])for(let stripe=-2;stripe<=2;stripe++) {
      markTransform.position.set(x+stripe*1.65,.032,z+side*6.3);markTransform.scale.set(.80,.025,2.1);markTransform.updateMatrix();markMatrices.push(markTransform.matrix.clone());
      markTransform.position.set(x+side*6.3,.032,z+stripe*1.65);markTransform.scale.set(2.1,.025,.80);markTransform.updateMatrix();markMatrices.push(markTransform.matrix.clone());
    }
  }
  const roadMarks=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mats.line,markMatrices.length);
  markMatrices.forEach((matrix,i)=>roadMarks.setMatrixAt(i,matrix));const markCount=markMatrices.length;
  roadMarks.count=markCount;roadMarks.computeBoundingSphere();scene.add(roadMarks);
  // Street details give the blocks scale from eye level.
  const taxiMat=new THREE.MeshStandardMaterial({color:0xdba831,roughness:.32,metalness:.35});
  const carPaints=[taxiMat,new THREE.MeshStandardMaterial({color:0x53636d,roughness:.34,metalness:.38}),new THREE.MeshStandardMaterial({color:0xb9b9b3,roughness:.35,metalness:.3}),new THREE.MeshStandardMaterial({color:0x7a3434,roughness:.38,metalness:.3})];
  const carGlass=new THREE.MeshStandardMaterial({color:0x263b46,roughness:.18,metalness:.48}), lampMat=material(0x404c50);
  for(const paint of [...carPaints,carGlass]){paint.envMap=skyReflection;paint.envMapIntensity=.7;}
  const headlightMat=new THREE.MeshStandardMaterial({color:0xfff4d9,emissive:0xffdfaa,emissiveIntensity:.38,roughness:.3});
  const taillightMat=new THREE.MeshStandardMaterial({color:0xa52826,emissive:0x6d1110,emissiveIntensity:.25,roughness:.35});
  const rubber=material(0x22292d), foliage=material(0x496b55), bark=material(0x695c4c);
  const barkCanvas=document.createElement('canvas');barkCanvas.width=128;barkCanvas.height=128;
  const barkContext=barkCanvas.getContext('2d');barkContext.fillStyle='#d6d2c9';barkContext.fillRect(0,0,128,128);
  for(let i=0;i<90;i++) {
    const x=random(i*11+4)*128,y=random(i*29+8)*128;
    barkContext.fillStyle=i%2?'rgba(80,69,59,.16)':'rgba(255,255,255,.20)';barkContext.fillRect(x,y,1+random(i+6)*2,8+random(i+3)*38);
  }
  const barkTexture=new THREE.CanvasTexture(barkCanvas);barkTexture.colorSpace=THREE.SRGBColorSpace;barkTexture.wrapS=barkTexture.wrapT=THREE.RepeatWrapping;
  barkTexture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());bark.map=barkTexture;
  const metalTrim=new THREE.MeshStandardMaterial({color:0x9aabae,roughness:.28,metalness:.7,envMap:skyReflection,envMapIntensity:.6});
  const wheelGeo=new THREE.CylinderGeometry(.34,.34,.2,20), hubGeo=new THREE.CylinderGeometry(.20,.20,.205,16);
  const trimGeometry=new THREE.BoxGeometry(1,1,1);
  function vehicleTrim(group,parts) {
    const trim=new THREE.InstancedMesh(trimGeometry,metalTrim,parts.length),transform=new THREE.Object3D();
    parts.forEach((part,i)=>{transform.position.set(part[0],part[1],part[2]);transform.scale.set(part[3],part[4],part[5]);transform.updateMatrix();trim.setMatrixAt(i,transform.matrix);});
    trim.computeBoundingSphere();group.add(trim);
  }
  const cars=[], pedestrians=[], dogs=[], helicopters=[], projectiles=[], splatters=[], chargeProps=[];
  // Curved coachwork, tapered glazing, wheel hubs and lights form a compact sedan.
  const carShape=new THREE.Shape();
  carShape.moveTo(-.78,.27);carShape.lineTo(.78,.27);carShape.quadraticCurveTo(.91,.27,.91,.40);
  carShape.lineTo(.91,.75);carShape.quadraticCurveTo(.91,.87,.78,.87);carShape.lineTo(-.78,.87);
  carShape.quadraticCurveTo(-.91,.87,-.91,.75);carShape.lineTo(-.91,.40);carShape.quadraticCurveTo(-.91,.27,-.78,.27);
  const bodyGeo=new THREE.ExtrudeGeometry(carShape,{depth:3.45,bevelEnabled:true,bevelSize:.09,bevelThickness:.09,bevelSegments:2,steps:1});
  bodyGeo.translate(0,0,-1.725);
  function sedanCabin(material) {
    const v=[-.72,.86,-1.03, .72,.86,-1.03, -.62,1.38,-.57, .62,1.38,-.57,
             -.72,.86,1.03, .72,.86,1.03, -.62,1.38,.65, .62,1.38,.65];
    const indices=[0,1,3,0,3,2, 4,6,7,4,7,5, 0,2,6,0,6,4, 1,5,7,1,7,3, 2,3,7,2,7,6];
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setIndex(indices);geo.computeVertexNormals();
    return new THREE.Mesh(geo,material);
  }
  function makeTrafficState(group,speed,hx,hz,top,seed) {
    const roadX=Math.round(group.position.x/40)*40,inBrooklyn=group.position.x>300;
    return {group,speed,minZ:inBrooklyn?brooklyn.minZ+12:manhattanMinZ+12,maxZ:inBrooklyn?brooklyn.maxZ-14:manhattanMaxZ-14,roadMin:inBrooklyn?360:-240,roadMax:inBrooklyn?760:240,currentSpeed:speed,hx,hz,top,seed,stuck:false,webRemaining:0,webElapsed:0,
      roadX,preferredLane:group.position.x,laneTarget:group.position.x,laneCooldown:0,lateralSpeed:0,roll:false};
  }
  function parkedCar(x,z,seed) {
    const group=new THREE.Group(); group.position.set(x,0,z); scene.add(group);
    const paint=carPaints[Math.floor(random(seed+50)*carPaints.length)];
    const body=new THREE.Mesh(bodyGeo,paint);body.castShadow=true;body.receiveShadow=true;group.add(body);
    const cabin=sedanCabin(carGlass);cabin.castShadow=true;group.add(cabin);
    box(1.28,.08,1.2,paint,0,1.4,.04,group);
    for(const dx of [-.91,.91]) for(const dz of [-1.12,1.12]) {
      const wheel=new THREE.Mesh(wheelGeo,rubber);wheel.rotation.z=Math.PI/2;wheel.position.set(dx,.34,dz);group.add(wheel);
      const hub=new THREE.Mesh(hubGeo,metalTrim);hub.rotation.z=Math.PI/2;hub.position.set(dx*1.01,.34,dz);group.add(hub);
    }
    for(const dx of [-.62,.62]) {
      box(.32,.16,.04,headlightMat,dx,.68,-1.82,group);box(.32,.13,.04,taillightMat,dx,.68,1.82,group);
      box(.23,.08,.16,paint,dx*1.48,1.0,-.55,group);
      box(.24,.04,.03,metalTrim,dx*.97,.79,.48,group);
    }
    box(1.30,.13,.04,lampMat,0,.48,-1.82,group);box(1.5,.06,.07,metalTrim,0,.34,1.82,group);
    vehicleTrim(group,[[0,.56,-1.845,1.05,.025,.025],[-.92,.84,0,.035,.035,2.8],[.92,.84,0,.035,.035,2.8],[-.72,1.04,-.85,.035,.38,.035],[.72,1.04,-.85,.035,.38,.035],[-.72,1.04,.87,.035,.38,.035],[.72,1.04,.87,.035,.38,.035],[0,.56,1.845,.52,.12,.02]]);
    if(paint===taxiMat) {box(.46,.16,.27,mats.white,0,1.53,.02,group);}
    group.traverse(child=>{if(child.isMesh) child.castShadow=true;});
    const car=makeTrafficState(group,5+random(seed+52)*3,.95,1.85,1.6,seed);car.modelKind=paint===taxiMat?'taxi':'sedan';car.originalVisual=group.children.slice();group.userData.actor=car;cars.push(car);return car;
  }
  // Delivery vans, buses, and pickups share the existing traffic and web behavior.
  function cityVehicle(x,z,seed,type) {
    const group=new THREE.Group();group.position.set(x,0,z);scene.add(group);
    const paint=carPaints[Math.floor(random(seed+50)*carPaints.length)];
    const bus=type==='bus',van=type==='van',halfLength=bus?3.65:2.45,top=bus?2.65:van?2.2:1.75;
    box(1.85,bus?1.95:van?1.5:.7,halfLength*2-.2,paint,0,bus?1.28:van?1.06:.62,0,group);
    if(type==='pickup') {
      const cab=sedanCabin(carGlass);cab.position.set(0,0,-.65);group.add(cab);
      box(1.5,.08,1.25,paint,0,1.39,-.62,group);
      for(const side of [-1,1])box(.1,.45,1.5,paint,side*.86,1.03,1.35,group);
    } else {
      box(1.6,.72,.06,carGlass,0,top-.5,-halfLength+.08,group);
      for(const side of [-1,1]) {
        const windows=bus?5:2;
        for(let i=0;i<windows;i++)box(.035,.52,bus?.82:1.05,carGlass,side*.94,top-.55,-halfLength+.9+i*(bus?1.15:1.2),group);
        box(.04,.09,halfLength*1.8,metalTrim,side*.95,.6,0,group);
      }
    }
    for(const side of [-1,1])for(const dz of [-halfLength+.8,halfLength-.8]) {
      const wheel=new THREE.Mesh(wheelGeo,rubber);wheel.rotation.z=Math.PI/2;wheel.position.set(side*.96,.34,dz);group.add(wheel);
      const hub=new THREE.Mesh(hubGeo,metalTrim);hub.rotation.z=Math.PI/2;hub.position.set(side*.97,.34,dz);group.add(hub);
    }
    for(const side of [-.6,.6]){box(.3,.15,.04,headlightMat,side,.72,-halfLength,group);box(.3,.15,.04,taillightMat,side,.72,halfLength,group);}
    box(1.5,.12,.08,metalTrim,0,.38,-halfLength,group);
    group.traverse(child=>{if(child.isMesh)child.castShadow=true;});
    const car=makeTrafficState(group,(bus?4.2:5)+random(seed+24)*1.6,1.02,halfLength,top,seed+700);
    car.vehicleType=type;car.modelKind=type==='van'?'van':null;car.originalVisual=group.children.slice();group.userData.actor=car;cars.push(car);
  }
  const fireRed=new THREE.MeshStandardMaterial({color:0xa72c2d,roughness:.34,metalness:.3});
  const warningRed=new THREE.MeshStandardMaterial({color:0xff3730,emissive:0xaa120b,emissiveIntensity:1.2});
  function fireTruck(x,z,seed) {
    const group=new THREE.Group();group.position.set(x,0,z);scene.add(group);
    box(2,.9,5.9,fireRed,0,.75,0,group);box(1.94,.85,1.8,fireRed,0,1.48,-1.95,group);
    box(1.73,.57,.06,carGlass,0,1.6,-2.88,group);
    for(const side of [-1,1]) {
      box(.05,.43,1.18,carGlass,side*1.0,1.62,-1.95,group);
      box(.06,.16,5.6,mats.white,side*1.02,.83,0,group);
      for(const z0 of [-1.9,0,2]) {
        const wheel=new THREE.Mesh(wheelGeo,rubber);wheel.rotation.z=Math.PI/2;wheel.position.set(side*1.03,.34,z0);wheel.scale.set(1.25,1,1.25);group.add(wheel);
        const hub=new THREE.Mesh(hubGeo,metalTrim);hub.rotation.z=Math.PI/2;hub.position.set(side*1.04,.34,z0);group.add(hub);
      }
      for(const z0 of [-.5,.6,1.7]) box(.06,.55,.75,metalTrim,side*1.02,1.47,z0,group);
      box(.38,.18,.08,mats.white,side*.65,.62,-3.0,group);
    }
    box(1.75,.18,.12,metalTrim,0,.4,-3.02,group);box(1.55,.35,.06,lampMat,0,.62,-3.02,group);
    box(1.5,.14,4.1,metalTrim,0,2.03,.55,group);
    for(const x0 of [-.62,.62]) box(.08,.1,4,metalTrim,x0,2.16,.55,group);
    for(let z0=-1.2;z0<2.5;z0+=.42) box(1.24,.05,.06,metalTrim,0,2.19,z0,group);
    for(const x0 of [-.65,.65]) box(.24,.16,.25,warningRed,x0,2,-2.1,group);
    group.traverse(child=>{if(child.isMesh)child.castShadow=true;});
    const car=makeTrafficState(group,4.8+random(seed)*1.2,1.08,3.05,2.3,seed+500);car.modelKind='firetruck';car.originalVisual=group.children.slice();
    car.normalSpeed=car.speed;car.beacon=new THREE.Group();car.beacon.visible=false;group.add(car.beacon);
    const redLight=new THREE.MeshBasicMaterial({color:0xff3030}),blueLight=new THREE.MeshBasicMaterial({color:0x54b7ff});
    box(.3,.2,.3,redLight,-.55,2.45,-2,car.beacon);box(.3,.2,.3,blueLight,.55,2.45,-2,car.beacon);
    group.userData.actor=car;cars.push(car);
  }
  const fabricCanvas=document.createElement('canvas');fabricCanvas.width=64;fabricCanvas.height=64;
  const fabricContext=fabricCanvas.getContext('2d');fabricContext.fillStyle='#e5e4df';fabricContext.fillRect(0,0,64,64);
  for(let i=0;i<64;i+=3){fabricContext.fillStyle='rgba(90,91,89,.12)';fabricContext.fillRect(0,i,64,1);fabricContext.fillStyle='rgba(255,255,255,.15)';fabricContext.fillRect(i,0,1,64);}
  const fabricTexture=new THREE.CanvasTexture(fabricCanvas);fabricTexture.colorSpace=THREE.SRGBColorSpace;
  fabricTexture.wrapS=fabricTexture.wrapT=THREE.RepeatWrapping;fabricTexture.repeat.set(2,2);
  fabricTexture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  const fabric=color=>new THREE.MeshStandardMaterial({color,map:fabricTexture,roughness:.92});
  const shirts=[fabric(0x385878),fabric(0x865a51),fabric(0x6d765d),fabric(0x55515f),fabric(0x8e7d69),fabric(0xa56a45),fabric(0x477779),fabric(0x75608c),fabric(0xb68a58)];
  const skinMats=[material(0xd5a47e),material(0x946044),material(0x664632),material(0xe0b99c)];
  const trousers=[fabric(0x343c48),fabric(0x3e5061),fabric(0x49433f)];
  const hairMats=[material(0x282522),material(0x493328),material(0x837263)];
  const shoeMat=material(0x292b2e), eyeMat=material(0x292827);
  const roleCloth={worker:fabric(0xd29c35),courier:fabric(0x346b91),performer:fabric(0x8b5267),office:fabric(0x3d4d60),jogger:fabric(0x48978c),vendor:fabric(0xe6dfcb)};
  const roleAccent=material(0xe4c85e),roleRed=material(0xb94a40),roleDark=material(0x2d3438),roleLight=material(0xe8ded0);
  const roundGeo=new THREE.SphereGeometry(1,16,12);
  function oval(parent,mat,x,y,z,sx,sy,sz) {
    const mesh=new THREE.Mesh(roundGeo,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh;
  }
  const crookShirt=material(0x1f1f24),crookPants=material(0x2a2a30),bandanaMat=material(0xb3262e),copShirt=material(0x22417f),copPants=material(0x1a2238),badgeGold=new THREE.MeshStandardMaterial({color:0xd9b23a,metalness:.7,roughness:.3});
  function makePedestrian(x,z,seed,blockX,blockZ,style=null) {
    const group=new THREE.Group();group.position.set(x,.45,z);scene.add(group);
    const crook=style==='thug'||style==='brute'||style==='gunner';
    const roles=['tourist','courier','worker','performer','office','jogger','influencer','neighbor'];
    const role=style||roles[Math.floor(random(seed+111)*roles.length)];
    const cop=style==='cop';
    const shirt=cop?copShirt:crook?crookShirt:(roleCloth[role]||shirts[Math.floor(random(seed+10)*shirts.length)]),skin=skinMats[Math.floor(random(seed+20)*skinMats.length)];
    const pants=cop?copPants:crook?crookPants:trousers[Math.floor(random(seed+30)*trousers.length)],hair=hairMats[Math.floor(random(seed+40)*hairMats.length)];
    // Tapered torso and shaped limbs, with separate pivot points for a walking gait.
    const torso=new THREE.Mesh(new THREE.CylinderGeometry(.22,.18,.58,12),shirt);torso.scale.z=.68;torso.position.y=1.12;group.add(torso);
    oval(group,pants,0,.78,0,.19,.15,.13);
    const head=new THREE.Group();head.position.y=1.63;group.add(head);
    oval(head,skin,0,0,0,.15,.20,.14);oval(head,hair,0,.13,.005,.155,.11,.145);
    oval(head,skin,0,-.035,-.142,.038,.045,.035);
    for(const side of [-1,1]) {
      oval(head,mats.white,side*.055,.025,-.132,.025,.018,.012);
      oval(head,eyeMat,side*.055,.025,-.144,.010,.011,.008);
      oval(head,hair,side*.055,.057,-.128,.032,.008,.009);
      oval(head,skin,side*.15,-.005,0,.025,.046,.035);
    }
    oval(head,eyeMat,0,-.073,-.137,.033,.006,.006);
    // Crooks wear a red bandana over the lower face.
    if(crook)oval(head,bandanaMat,0,-.07,-.015,.158,.09,.15);
    const limbs=[];
    for(const side of [-1,1]) {
      const leg=new THREE.Group();leg.position.set(side*.105,.77,0);group.add(leg);
      oval(leg,pants,0,-.19,0,.095,.25,.09);
      const knee=new THREE.Group();knee.position.y=-.38;leg.add(knee);leg.userData.knee=knee;
      oval(knee,pants,0,-.10,0,.075,.21,.075);oval(knee,shoeMat,0,-.32,-.055,.09,.07,.15);limbs.push(leg);
    }
    for(const side of [-1,1]) {
      const arm=new THREE.Group();arm.position.set(side*.23,1.36,0);group.add(arm);
      // People face local -Z; a relaxed elbow keeps the hands slightly forward.
      oval(arm,shirt,0,-.15,0,.075,.21,.075);
      const forearm=oval(arm,skin,0,-.34,-.065,.056,.15,.056);forearm.rotation.x=.45;
      oval(arm,skin,0,-.49,-.13,.06,.075,.045);arm.userData.handPoint=new THREE.Vector3(0,-.49,-.13);limbs.push(arm);
    }
    oval(group,skin,0,1.44,0,.075,.07,.07);
    if(!crook && random(seed+71)>.68)oval(group,pants,0,1.08,.17,.19,.28,.10);
    if(random(seed+73)>.75)box(.31,.045,.25,hair,0,1.81,-.015,group);
    if(!crook && random(seed+75)>.82)box(.13,.20,.09,mats.white,.11,-.55,-.13,limbs[3]);
    if(role==='worker') {
      oval(head,roleAccent,0,.18,0,.18,.085,.17);box(.42,.055,.06,roleLight,0,1.17,-.145,group);
    } else if(role==='courier') {
      box(.36,.5,.19,roleRed,0,1.09,.19,group);box(.3,.07,.025,roleLight,0,1.16,.295,group);
    } else if(role==='tourist') {
      oval(head,roleLight,0,.19,0,.2,.035,.18);oval(head,roleLight,0,.23,0,.13,.08,.12);
      box(.22,.16,.09,roleDark,0,1.22,-.19,group);oval(group,roleLight,0,1.22,-.245,.05,.05,.025);
    } else if(role==='influencer') {
      box(.12,.20,.035,roleDark,0,-.46,-.19,limbs[3]);
    } else if(role==='office') {
      box(.07,.34,.03,roleRed,0,1.12,-.16,group);box(.23,.26,.1,roleDark,0,-.53,-.13,limbs[3]);
    } else if(role==='performer') {
      oval(head,roleRed,0,.19,0,.17,.065,.16);box(.32,.26,.11,roleAccent,0,1.06,-.17,group);
    } else if(role==='jogger') {
      box(.29,.05,.03,roleLight,0,.07,-.146,head);
    } else if(role==='vendor') {
      box(.32,.45,.04,roleLight,0,1.02,-.16,group);
    }
    let gunMount=null;
    if(style==='gunner'){gunMount=new THREE.Group();gunMount.position.set(0,-.49,-.13);limbs[3].add(gunMount);box(.06,.08,.26,crookPants,0,0,-.12,gunMount);}
    if(style==='brute')group.scale.set(1.25,1.12,1.25);
    if(cop) {
      // Police cap, badge and a taser in the right hand.
      box(.3,.08,.3,copShirt,0,.17,.005,head);box(.31,.025,.13,copPants,0,.135,-.17,head);box(.05,.05,.015,badgeGold,0,.18,-.155,head);
      box(.055,.065,.015,badgeGold,-.1,1.26,-.15,group);
      const taser=new THREE.Group();taser.position.set(0,-.49,-.1);limbs[3].add(taser);box(.05,.07,.18,material(0xe3c22a),0,0,-.08,taser);
    }
    group.traverse(child=>{if(child.isMesh)child.castShadow=true;});
    // Preserve animated limb pivots while batching repeated pieces within each pivot.
    for(const pivot of [group,head,...limbs,...limbs.filter(limb=>limb.userData.knee).map(limb=>limb.userData.knee)]) {
      const groups=new Map();
      for(const child of pivot.children)if(child.isMesh && child.geometry===roundGeo) {
        if(!groups.has(child.material))groups.set(child.material,[]);groups.get(child.material).push(child);
      }
      for(const [mat,parts] of groups)if(parts.length>1) {
        const batch=new THREE.InstancedMesh(roundGeo,mat,parts.length);batch.castShadow=true;
        parts.forEach((part,i)=>{part.updateMatrix();batch.setMatrixAt(i,part.matrix);pivot.remove(part);});
        batch.computeBoundingSphere();pivot.add(batch);
      }
    }
    const route=[{x:blockX+6.4,z:blockZ+6.4},{x:blockX+33.6,z:blockZ+6.4},
      {x:blockX+33.6,z:blockZ+33.6},{x:blockX+6.4,z:blockZ+33.6}];
    const direction=random(seed+1)>.5?1:-1;
    const person={group,head,leftLeg:limbs[0],rightLeg:limbs[1],leftArm:limbs[2],rightArm:limbs[3],role,gunMount,
      route,blockX,blockZ,target:direction===1?0:3,direction,speed:(1.05+random(seed+4)*.45)*(role==='jogger'?1.45:role==='courier'?1.2:1),seed,step:0,pause:random(seed+7)*2,hx:.34,hz:.34,top:2.3,uprightTop:2.3,webRemaining:0,webPose:0,visit:null,stuck:false};
    person.proxyColor=shirt.color;group.userData.actor=person;pedestrians.push(person);return person;
  }
  // Positive shoulder rotation moves an NPC's hands toward the face (-Z).
  function poseWalkingArms(person,stride,running=false) {
    const forward=running ? .32 : .12;
    person.leftArm.rotation.x=forward-stride*.65;person.rightArm.rotation.x=forward+stride*.65;
  }
  function pedestrianHandPoint(person,side='right') {
    const arm=side==='left'?person.leftArm:person.rightArm;
    return arm.localToWorld((arm.userData.handPoint||new THREE.Vector3(0,-.51,0)).clone());
  }
  const dogCoats=[material(0xa67d58),material(0x4d4036),material(0xd3c1a0)];
  const leashMat=new THREE.LineBasicMaterial({color:0x58423a});
  function makeDog(owner,seed) {
    const group=new THREE.Group();group.userData.targetable=true;scene.add(group);
    const coat=dogCoats[Math.floor(random(seed+13)*dogCoats.length)];
    oval(group,coat,0,.47,0,.24,.27,.43);oval(group,coat,0,.65,-.42,.20,.20,.21);
    oval(group,coat,0,.61,-.60,.12,.10,.16);
    oval(group,eyeMat,0,.65,-.74,.06,.04,.025);
    for(const side of [-1,1]) {oval(group,coat,side*.18,.70,-.4,.07,.14,.09);oval(group,eyeMat,side*.09,.69,-.58,.017,.017,.014);}
    const collar=new THREE.Mesh(new THREE.TorusGeometry(.20,.025,6,16),awning);collar.position.set(0,.57,-.28);collar.scale.set(1,1.15,1);group.add(collar);
    const legs=[];for(const x of [-.15,.15])for(const z of [-.27,.25]){
      const leg=new THREE.Group();leg.position.set(x,.34,z);group.add(leg);oval(leg,coat,0,-.16,0,.065,.2,.06);legs.push(leg);
    }
    const tail=oval(group,coat,0,.61,.47,.06,.06,.28);tail.rotation.x=-.6;
    const leash=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),leashMat);scene.add(leash);
    group.position.copy(owner.group.position);const dog={owner,group,legs,leash,phase:random(seed)*6};dogs.push(dog);owner.dog=dog;
  }
  function makeWheelchair(person) {
    for(const child of person.group.children)child.position.y-=.24;
    const chair=new THREE.Group();person.group.add(chair);
    const metalFrame=new THREE.MeshStandardMaterial({color:0x7d9096,metalness:.65,roughness:.35});
    box(.58,.08,.55,mats.blue,0,.49,.02,chair);box(.56,.66,.07,mats.blue,0,.82,.29,chair);
    const wheelGeometry=new THREE.TorusGeometry(.33,.045,8,20),wheels=[];
    for(const side of [-1,1]){
      const wheel=new THREE.Mesh(wheelGeometry,metalFrame);wheel.rotation.y=Math.PI/2;wheel.position.set(side*.38,.34,.05);chair.add(wheel);wheels.push(wheel);
      const hub=new THREE.Mesh(new THREE.SphereGeometry(.045,10,8),metalFrame);hub.position.copy(wheel.position);chair.add(hub);
      for(let a=0;a<4;a++){const spoke=box(.016,.62,.016,metalFrame,side*.38,.34,.05,chair);spoke.rotation.x=a*Math.PI/4;}
      box(.07,.08,.62,metalFrame,side*.31,.65,0,chair);
      const caster=new THREE.Mesh(new THREE.TorusGeometry(.085,.028,6,12),metalFrame);caster.rotation.y=Math.PI/2;caster.position.set(side*.28,.1,-.42);chair.add(caster);
    }
    box(.58,.06,.18,metalFrame,0,.15,-.48,chair);person.wheelchair={chair,wheels};person.hx=.52;person.hz=.52;restoreWheelchair(person);
  }
  function poseSittingLegs(person,angle) {
    for(const leg of [person.leftLeg,person.rightLeg]) {
      leg.rotation.x=angle;
      if(leg.userData.knee)leg.userData.knee.rotation.x=-angle;
    }
  }
  function restoreWheelchair(person) {
    poseSittingLegs(person,1.15);
    person.leftArm.rotation.x=person.rightArm.rotation.x=0;
  }
  const blanketMat=material(0x6a766f),bedrollMat=material(0x635953),bagMat=material(0x5b625c);
  const cardboard=material(0x9e7952), cupMat=material(0xd2c7ac), cupInside=material(0x776c58);
  const beardMat=material(0x544a42), coatMat=material(0x555b53), scarfMat=material(0x776b5e);
  const goldMat=new THREE.MeshStandardMaterial({color:0xc7a456,metalness:.75,roughness:.3});
  const coinGeo=new THREE.CylinderGeometry(.035,.035,.009,14);
  const signCanvas=document.createElement('canvas');signCanvas.width=512;signCanvas.height=256;
  const signContext=signCanvas.getContext('2d');signContext.fillStyle='#b89568';signContext.fillRect(0,0,512,256);
  signContext.strokeStyle='#94754f';signContext.lineWidth=3;
  for(let y=8;y<256;y+=15){signContext.beginPath();signContext.moveTo(0,y);signContext.lineTo(512,y+2);signContext.stroke();}
  signContext.fillStyle='#40352d';signContext.textAlign='center';signContext.font='bold 62px sans-serif';
  signContext.fillText('ANY HELP',256,103);signContext.font='bold 48px sans-serif';signContext.fillText('THANK YOU',256,184);
  const signTexture=new THREE.CanvasTexture(signCanvas);signTexture.colorSpace=THREE.SRGBColorSpace;
  const signMat=new THREE.MeshStandardMaterial({map:signTexture,roughness:1,side:THREE.DoubleSide});
  function seatedRest(person) {
    poseSittingLegs(person,0);
    person.leftArm.rotation.x=0;person.rightArm.rotation.x=0;
  }
  function makeShelter(x,z,seed,blockX,blockZ) {
    const person=makePedestrian(x,z,seed,blockX,blockZ),g=person.group;
    person.settled=true;person.hx=.48;person.hz=.55;person.top=person.uprightTop=1.85;
    g.clear();g.rotation.y=Math.PI/2;
    const skin=skinMats[Math.floor(random(seed+20)*skinMats.length)];
    // A layered coat, scarf, shaped face, and bent limbs make a distinct seated figure.
    oval(g,coatMat,0,.75,0,.24,.35,.16);oval(g,scarfMat,0,1.07,-.015,.17,.11,.15);
    box(.18,.24,.035,scarfMat,.07,.91,-.165,g);box(.24,.12,.035,scarfMat,-.08,.75,-.17,g);
    box(.14,.12,.02,blanketMat,.10,.77,-.175,g);box(.02,.34,.02,bagMat,-.01,.77,-.18,g);
    person.head=new THREE.Group();person.head.position.set(0,1.32,0);g.add(person.head);
    oval(person.head,skin,0,0,0,.145,.18,.13);oval(person.head,beardMat,0,-.11,-.06,.13,.075,.10);
    oval(person.head,skin,0,-.015,-.133,.027,.045,.027);
    for(const side of [-1,1]) {
      oval(person.head,skin,side*.145,-.01,.005,.024,.04,.023);
      oval(person.head,eyeMat,side*.052,.025,-.124,.009,.009,.007);
      oval(person.head,beardMat,side*.052,.052,-.124,.035,.008,.008);
    }
    const hat=oval(person.head,coatMat,0,.145,0,.155,.09,.14);hat.scale.z=.14;
    box(.30,.035,.23,coatMat,0,.12,-.025,person.head);
    const limbs=[];
    for(const side of [-1,1]) {
      const leg=new THREE.Group();leg.position.set(side*.11,.45,0);g.add(leg);
      const thigh=oval(leg,trousers[0],0,-.015,-.19,.10,.24,.10);thigh.rotation.x=Math.PI/2;
      const shin=oval(leg,trousers[0],0,-.16,-.39,.078,.20,.075);shin.rotation.x=.4;
      oval(leg,shoeMat,0,-.31,-.46,.10,.065,.16);limbs.push(leg);
    }
    for(const side of [-1,1]) {
      const arm=new THREE.Group();arm.position.set(side*.22,1.02,0);g.add(arm);
      oval(arm,coatMat,side*.015,-.14,0,.085,.21,.082);
      const forearm=oval(arm,coatMat,side*.025,-.34,-.17,.07,.21,.07);forearm.rotation.x=.85;
      oval(arm,skin,side*.03,-.45,-.32,.06,.055,.075);arm.userData.handPoint=new THREE.Vector3(side*.03,-.45,-.32);limbs.push(arm);
    }
    [person.leftLeg,person.rightLeg,person.leftArm,person.rightArm]=limbs;
    // The cup and sign are attached to the hands, so they move with the figure.
    const cup=new THREE.Group();cup.position.set(.03,-.43,-.34);person.rightArm.add(cup);
    const cupBody=new THREE.Mesh(new THREE.CylinderGeometry(.09,.065,.17,16,1,true),cupMat);cup.add(cupBody);
    const cupBottom=new THREE.Mesh(new THREE.CircleGeometry(.065,16),cupInside);cupBottom.rotation.x=-Math.PI/2;cupBottom.position.y=-.085;cup.add(cupBottom);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(.09,.007,8,20),cupMat);rim.rotation.x=Math.PI/2;rim.position.y=.085;cup.add(rim);
    person.cup=cup;person.cupCoins=[];
    const sign=new THREE.Group();sign.position.set(.23,-.34,-.38);person.leftArm.add(sign);
    box(.65,.36,.025,cardboard,0,0,0,sign);
    const label=new THREE.Mesh(new THREE.PlaneGeometry(.63,.34),signMat);label.position.z=-.014;label.rotation.y=Math.PI;sign.add(label);
    box(1.15,.07,1.5,blanketMat,x,.48,z);
    oval(scene,bedrollMat,x+.35,.61,z+.45,.24,.15,.42);
    oval(scene,bagMat,x+.43,.66,z-.5,.22,.22,.28);
    g.traverse(child=>{if(child.isMesh)child.castShadow=true;});seatedRest(person);
  }
  function tree(x,z,seed) {parkTree(x,z,seed,.45,true);}
  // Fine, repeating surface detail keeps the park from reading as a flat green plane.
  function parkTexture(base, flecks, repeat) {
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
    const ctx=canvas.getContext('2d');ctx.fillStyle=base;ctx.fillRect(0,0,256,256);
    for(let i=0;i<3600;i++) {
      const x=random(i*2+23)*256,y=random(i*2+24)*256;
      ctx.fillStyle=flecks[i%flecks.length];ctx.fillRect(x,y,1+random(i+40)*2,1+random(i+90)*3);
    }
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(repeat,repeat);
    texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return texture;
  }
  const turfLoader=new THREE.TextureLoader();
  function turfTexture(path,repeat,color=false) {
    const texture=turfLoader.load(path);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(repeat,repeat);
    texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());if(color)texture.colorSpace=THREE.SRGBColorSpace;return texture;
  }
  const grassMap=turfTexture('assets/materials/grass-color.jpg',.38,true),grassNormal=turfTexture('assets/materials/grass-normal.jpg',.38);
  const grassMat=new THREE.MeshStandardMaterial({map:grassMap,normalMap:grassNormal,normalScale:new THREE.Vector2(.35,.35),roughness:1});
  const pathMat=new THREE.MeshStandardMaterial({map:parkTexture('#b9af9b',['#b0a591','#c8bfab','#a49b8c','#c1b6a1'],5),roughness:1});
  const woodMat=material(0x806144),parkMetal=material(0x3e5046);
  const foliageTexture=parkTexture('#a5ad8c',['#8d9b79','#c0c6a3','#778866','#aab997'],1);
  const parkLeaves=[0x456c47,0x638654,0x526f42,0x77945d,0x8c8350].map(color=>new THREE.MeshStandardMaterial({color,map:foliageTexture,roughness:1}));
  const canopyLeaves=parkLeaves.map(leaf=>{const mat=leaf.clone();mat.vertexColors=true;return mat;});
  const birchBark=material(0xc1bcb0),pineNeedles=material(0x345c46),birchMark=material(0x5e6258);
  const waterMat=new THREE.MeshStandardMaterial({color:0x5c8990,roughness:.24,metalness:.24});
  const canopyGeometry=new THREE.IcosahedronGeometry(1,2),pineGeometry=new THREE.ConeGeometry(1,1,10);
  {
    const p=canopyGeometry.attributes.position,n=canopyGeometry.attributes.normal,colors=[];
    for(let i=0;i<p.count;i++) {
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),bump=1+.055*Math.sin(x*8+y*4)*Math.cos(z*7-y*3);
      p.setXYZ(i,x*bump,y*bump,z*bump);const length=Math.hypot(x,y,z)||1;n.setXYZ(i,x/length,y/length,z/length);
      const light=.78+.16*(y*.5+.5)+.06*random(x*31+y*41+z*53);colors.push(light,light,light*.96);
    }
    canopyGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));p.needsUpdate=true;n.needsUpdate=true;canopyGeometry.computeBoundingSphere();
  }
  // Low wooded rises sit beside the main paths and fade smoothly into the lawn.
  const parkHills=[[-66,-180,7.5,2.7],[27,-130,6,2.1],[-66,-108,7.5,2.3],
    [27,-23,6,1.8],[-66,-36,7.5,2.5],[-66,112,7.5,2.2],[27,135,6,1.8]];
  function parkElevation(x,z) {
    let height=0;
    for(const [cx,cz,rise,width] of parkHills) {
      const t=Math.max(0,1-Math.hypot(x-cx,z-cz)/rise);
      height=Math.max(height,width*t*t*(3-2*t));
    }
    return height;
  }
  const parkStructures=[],parkSoundTrails=[];
  function parkCollider(x,z,w,d,height,bottom=0,shape=null,walkable=false) {
    const collider={x,z,w,d,height,bottom,shape,parkStructure:true,walkable};
    parkStructures.push(collider);playerBuildingColliders.push(collider);
    if(!walkable && bottom<1.8) {
      const minX=Math.floor((x-w/2-2)/40),maxX=Math.floor((x+w/2+2)/40);
      const minZ=Math.floor((z-d/2-2)/40),maxZ=Math.floor((z+d/2+2)/40);
      for(let gx=minX;gx<=maxX;gx++)for(let gz=minZ;gz<=maxZ;gz++) {
        const key=`${gx},${gz}`;if(!buildingCells.has(key))buildingCells.set(key,[]);
        buildingCells.get(key).push(collider);
      }
    }
    return collider;
  }
  function registerProp(group,hx,hz,top,propType='prop') {
    const actor={group,kind:'prop',propType,hx,hz,top,uprightTop:top,seed:group.position.x+group.position.z,origin:group.position.clone(),originRotation:group.rotation.clone(),stuck:false,webRemaining:0};
    group.userData.actor=actor;group.userData.targetable=true;chargeProps.push(actor);return actor;
  }
  function bench(x,z,angle=0) {
    const group=new THREE.Group();group.position.set(x,inPark(x,z) ? .09+parkElevation(x,z) : .45,z);group.rotation.y=angle;group.userData.targetable=true;scene.add(group);
    registerProp(group,1,.5,1.4,'bench');
    for(let i=0;i<3;i++)box(1.9,.08,.19,woodMat,0,.50,-.22+i*.2,group);
    for(let i=0;i<3;i++)box(1.9,.12,.08,woodMat,0,.72+i*.18,.34,group);
    for(const side of [-.72,.72]){box(.08,.50,.08,parkMetal,side,.25,0,group);box(.08,.70,.08,parkMetal,side,.8,.34,group);}
  }
  function parkTree(x,z,seed,ground=.06,street=false) {
    const group=new THREE.Group();group.position.set(x,ground+(street?0:parkElevation(x,z)),z);group.userData.targetable=true;scene.add(group);
    const variety=random(seed+144),kind=variety<.35?0:variety<.68?1:variety<.86?3:2,height=(street?3.7:5.3)+random(seed+145)*3.1;
    group.userData.treeType=['broadleaf','maple','pine','birch'][kind];
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(kind===3?.13:.20,kind===3?.21:.32,height,10),kind===3?birchBark:bark);
    trunk.position.y=height/2;trunk.castShadow=true;group.add(trunk);
    if(kind===2) {
      for(let i=0;i<5;i++) {
        const cone=new THREE.Mesh(pineGeometry,pineNeedles);
        const width=(street?1.30:1.75)-i*.22;cone.scale.set(width,2.0,width);
        cone.position.y=height-1.7+i*.85;cone.rotation.y=i*.55;cone.castShadow=true;group.add(cone);
      }
    } else {
      if(kind===3) for(let y=1;y<height;y+=1.1)box(.28,.045,.05,birchMark,0,y,-.18,group);
      const leaf=canopyLeaves[(Math.floor(random(seed+146)*canopyLeaves.length)+(kind===1?1:0))%canopyLeaves.length];
      const count=kind===3?6:8,scale=street ? .75 : 1;
      for(let k=0;k<count;k++) {
        const angle=k*Math.PI*2/count+random(seed+k)*.3,spread=(kind===3?.8:1.55)*scale;
        const crown=new THREE.Mesh(canopyGeometry,leaf);
        crown.position.set(Math.cos(angle)*spread,height+.2+random(seed+k+41)*1.1,Math.sin(angle)*spread);
        const size=(1.05+random(seed+k+73)*.5)*scale;
        crown.scale.set(size*(kind===3?.85:1.2),size*(kind===3?1.55:1.15),size*(kind===3?.85:1.2));
        crown.rotation.set(random(seed+k+9),angle,random(seed+k+19));group.add(crown);
        crown.castShadow=true;
        if(k%2===0)beamBetween(group,[0,height*.58,0],[Math.cos(angle)*spread,height+.25,Math.sin(angle)*spread],.07,kind===3?birchBark:bark);
      }
    }
    // The leaf clusters are static parts of one tree and can share a draw call.
    const clusters=group.children.filter(child=>child.isMesh && (child.geometry===canopyGeometry || child.geometry===pineGeometry));
    if(clusters.length>1) {
      const batch=new THREE.InstancedMesh(clusters[0].geometry,clusters[0].material,clusters.length);batch.castShadow=true;
      clusters.forEach((cluster,i)=>{cluster.updateMatrix();batch.setMatrixAt(i,cluster.matrix);group.remove(cluster);});
      batch.computeBoundingSphere();group.add(batch);
    }
  }
  function makePark() {
    const groundShape=new THREE.Shape();groundShape.moveTo(-74.5,-194.5);groundShape.lineTo(34.5,-194.5);groundShape.lineTo(34.5,194.5);groundShape.lineTo(-74.5,194.5);groundShape.closePath();addWaterHoles(groundShape);
    const ground=new THREE.Mesh(new THREE.ShapeGeometry(groundShape),grassMat);ground.rotation.x=-Math.PI/2;ground.position.y=.06;ground.receiveShadow=true;scene.add(ground);
    for(const [x,z,radius] of parkHills) {
      const geometry=new THREE.PlaneGeometry(radius*2,radius*2,24,24);geometry.rotateX(-Math.PI/2);
      const vertices=geometry.attributes.position,uv=geometry.attributes.uv;
      for(let i=0;i<vertices.count;i++){const px=x+vertices.getX(i),pz=z+vertices.getZ(i);vertices.setY(i,.061+parkElevation(px,pz));uv.setXY(i,px,-pz);}
      geometry.computeVertexNormals();const hill=new THREE.Mesh(geometry,grassMat);hill.position.set(x,0,z);hill.receiveShadow=true;hill.userData.parkLandmark='wooded-rise';scene.add(hill);
    }
    const pathEdge=material(0x989582),lawnMat=new THREE.MeshStandardMaterial({color:0xf4f8ef,map:grassMap,normalMap:grassNormal,normalScale:new THREE.Vector2(.35,.35),roughness:1}),meadowMat=new THREE.MeshStandardMaterial({color:0xf2f7ec,map:grassMap,normalMap:grassNormal,normalScale:new THREE.Vector2(.35,.35),roughness:1});
    function ellipse(x,z,rx,rz,mat,y,name) {
      const geometry=new THREE.CircleGeometry(1,64),points=geometry.attributes.position,uv=geometry.attributes.uv;
      for(let i=0;i<points.count;i++)uv.setXY(i,x+points.getX(i)*rx,-z+points.getY(i)*rz);
      const mesh=new THREE.Mesh(geometry,mat);mesh.rotation.x=-Math.PI/2;mesh.scale.set(rx,rz,1);mesh.position.set(x,y,z);
      if(name)mesh.userData.parkLandmark=name;scene.add(mesh);return mesh;
    }
    function ring(x,z,rx,rz,inner,mat,y) {
      const mesh=new THREE.Mesh(new THREE.RingGeometry(inner,1,96),mat);mesh.rotation.x=-Math.PI/2;mesh.scale.set(rx,rz,1);mesh.position.set(x,y,z);scene.add(mesh);
    }
    // Irregular banks and a subtle tiled ripple texture make the water read as a lake.
    const waterCanvas=document.createElement('canvas');waterCanvas.width=waterCanvas.height=256;
    const wc=waterCanvas.getContext('2d');wc.fillStyle='#5b8583';wc.fillRect(0,0,256,256);
    for(let i=0;i<700;i++) {
      const px=random(i*7+2)*256,py=random(i*13+3)*256;
      wc.strokeStyle=i%3?'rgba(199,218,203,.09)':'rgba(29,62,64,.09)';wc.lineWidth=.5+random(i+4)*.7;
      wc.beginPath();wc.moveTo(px,py);wc.quadraticCurveTo(px+3,py-1,px+6+random(i+5)*9,py);wc.stroke();
    }
    const lakeTexture=new THREE.CanvasTexture(waterCanvas);lakeTexture.colorSpace=THREE.SRGBColorSpace;lakeTexture.wrapS=lakeTexture.wrapT=THREE.RepeatWrapping;lakeTexture.repeat.set(.075,.075);
    const lakeWater=new THREE.MeshStandardMaterial({map:lakeTexture,color:0xc7dbd1,roughness:.43,metalness:.12,transparent:true,opacity:.68,depthWrite:false});
    const shoreMat=new THREE.MeshStandardMaterial({color:0x827d69,map:pathMat.map,roughness:1});
    function pond(x,z,rx,rz,name) {
      function outline(extra) {
        const shape=new THREE.Shape();
        for(let i=0;i<=96;i++) {
          const a=i*Math.PI*2/96,variation=name==='reservoir'?1:1+.10*Math.sin(3*a+.4)+.045*Math.sin(5*a-.6);
          const px=Math.cos(a)*(rx*variation+extra),py=-Math.sin(a)*(rz*variation+extra);
          if(i===0)shape.moveTo(px,py);else shape.lineTo(px,py);
        }
        const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),extra?shoreMat:lakeWater);
        mesh.rotation.x=-Math.PI/2;mesh.position.set(x,extra?.08:.12,z);scene.add(mesh);return mesh;
      }
      outline(name==='reservoir'?1:1.3);const water=outline(0);water.userData.parkLandmark=name;
      const bed=new THREE.Mesh(water.geometry,material(0x405c53));bed.rotation.x=-Math.PI/2;bed.position.set(x,-1.05,z);scene.add(bed);
      return water;
    }
    function trail(points,width) {
      const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],.078,p[1]))),samples=curve.getPoints(70),vertices=[],indices=[];
      for(let i=0;i<samples.length;i++) {
        const tangent=curve.getTangent(i/(samples.length-1)),side=new THREE.Vector3(-tangent.z,0,tangent.x).normalize().multiplyScalar(width/2),v=samples[i];
        vertices.push(v.x+side.x,.078,v.z+side.z,v.x-side.x,.078,v.z-side.z);
        if(i<samples.length-1){const j=i*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);}
      }
      parkSoundTrails.push({samples,width});
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
      const mesh=new THREE.Mesh(geo,pathMat);mesh.material.side=THREE.DoubleSide;scene.add(mesh);
    }
    // Landmark order follows the Conservancy map, compressed to fit the game world.
    ellipse(-20,-126,32,20,meadowMat,.065,'north-meadow');
    pond(-4,-169,16,11,'harlem-meer');
    pond(-20,-70,32,39,'reservoir');ring(-20,-70,36,43,.91,pathMat,.076);
    ellipse(-20,-5,30,23,lawnMat,.065,'great-lawn');
    pond(-32,65,27,21,'the-lake');
    // A wooded islet and reeds give the Lake a layered shoreline.
    ellipse(-40,70,4.3,2.8,meadowMat,.14,'lake-islet');
    parkTree(-40,70,3101,.14);parkTree(-37.8,70.5,3102,.14);
    const reeds=new THREE.InstancedMesh(new THREE.ConeGeometry(.08,.8,5),parkLeaves[2],72),reedTransform=new THREE.Object3D();
    for(let i=0;i<72;i++) {
      const angle=i*Math.PI*2/72,variation=1+.10*Math.sin(3*angle+.4)+.045*Math.sin(5*angle-.6),rx=27*variation+.2+random(i+4500)*.7,rz=21*variation+.2+random(i+4501)*.7;
      reedTransform.position.set(-32+Math.cos(angle)*rx,.43,65+Math.sin(angle)*rz);
      reedTransform.scale.setScalar(.65+random(i+4502)*.5);reedTransform.updateMatrix();reeds.setMatrixAt(i,reedTransform.matrix);
    }
    reeds.count=72;reeds.computeBoundingSphere();scene.add(reeds);
    pond(-8,34,8,5,'turtle-pond');
    ellipse(-47,126,19,23,meadowMat,.065,'sheep-meadow');
    pond(4,172,13,9,'the-pond');
    ring(-20,0,49,183,.955,pathMat,.076);
    trail([[-60,-176],[-48,-150],[-54,-120],[-53,-95],[-55,-72],[-51,-38],[-50,-5],[-57,34],[-58,68],[-57,110],[-58,165]],2.6);
    trail([[18,-175],[14,-145],[19,-110],[18,-75],[18,-36],[18,-5],[17,31],[17,63],[8,84],[8,158],[20,180]],2.8);
    const mall=box(5,.035,78,pathMat,8,.06,122);mall.userData.parkLandmark='the-mall'; // South of Bethesda Terrace.
    for(let z=91;z<=157;z+=7) {parkTree(2,z,2100+z);parkTree(14,z,2200+z);}
    // Bethesda Terrace and fountain sit at the north end of the Mall, beside the Lake.
    const terrace=new THREE.Group();terrace.position.set(8,0,82);terrace.userData.parkLandmark='bethesda-terrace';terrace.userData.targetable=true;scene.add(terrace);
    box(12,.3,9,stone,0,.15,0,terrace);box(12,.18,1,stone,0,.33,-4.3,terrace);
    for(let n=0;n<3;n++)box(10-n*1.4,.12,1,stone,0,.12+n*.12,4+n*.6,terrace);
    const rim=new THREE.Mesh(new THREE.CylinderGeometry(3,3.3,.34,32),stone);rim.position.set(0,.42,0);terrace.add(rim);
    const fountain=new THREE.Mesh(new THREE.CylinderGeometry(2.65,2.65,.08,32),waterMat);fountain.position.set(0,.62,0);terrace.add(fountain);
    const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(.4,.6,1.2,16),stone);pedestal.position.set(0,1.22,0);terrace.add(pedestal);
    const sprayMat=new THREE.MeshBasicMaterial({color:0xc8e9ed,transparent:true,opacity:.68,depthWrite:false});
    for(let i=0;i<8;i++){const angle=i*Math.PI/4,dx=Math.cos(angle),dz=Math.sin(angle);const arc=new THREE.QuadraticBezierCurve3(new THREE.Vector3(dx*.25,1.85,dz*.25),new THREE.Vector3(dx*1.2,2.4,dz*1.2),new THREE.Vector3(dx*2.2,.67,dz*2.2));terrace.add(new THREE.Mesh(new THREE.TubeGeometry(arc,12,.025,4,false),sprayMat));}
    // A low bridge crosses the Lake; a stone turret marks Belvedere above Turtle Pond.
    const bridge=new THREE.Group();bridge.position.set(-32,.15,65);bridge.userData.parkLandmark='bow-bridge';bridge.userData.targetable=true;scene.add(bridge);
    box(62,.26,3.2,stone,0,.13,0,bridge);
    for(const side of [-1,1]) {
      box(62,.12,.12,mats.white,0,1.05,side*1.48,bridge);
      for(let x=-30;x<=30;x+=2) {
        box(.11,.9,.11,mats.white,x,.55,side*1.48,bridge);
        const detail=new THREE.Mesh(new THREE.TorusGeometry(.25,.035,5,12));detail.material=mats.white;detail.position.set(x+1,.65,side*1.48);bridge.add(detail);
      }
      for(const end of [-30,30])box(.42,1.3,.42,stone,end,.65,side*1.48,bridge);
    }
    const castle=new THREE.Group();castle.position.set(-43,.1,30);castle.userData.parkLandmark='belvedere';castle.userData.targetable=true;scene.add(castle);
    const tower=new THREE.Mesh(new THREE.CylinderGeometry(2.4,2.8,6,12),stone);tower.position.y=3;castle.add(tower);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(3,2.4,12),mats.roof);roof.position.y=7.2;castle.add(roof);
    box(6,.4,5,stone,2,.2,0,castle);for(const x of [-2,0,2,4])box(.55,.6,.55,stone,x,1,2.3,castle);
    castle.traverse(child=>{if(child.isMesh)grappleMeshes.push(child);});
    // Low platforms are walkable; columns, railings and fountain basins are solid.
    parkCollider(8,82,12,9,.3,0,null,true);
    parkCollider(8,82,6.6,6.6,.76,0,'round');
    parkCollider(8,82,1.2,1.2,1.85,0,'round');
    parkCollider(-32,65,62,3.2,.41,0,null,true);
    for(const side of [-1,1])parkCollider(-32,65+side*1.48,62,.24,1.45);
    parkCollider(-43,30,5.6,5.6,8.5,0,'round');
    parkCollider(-41,30,6,5,.5,0,null,true);
    for(const group of [terrace,bridge])group.traverse(child=>{if(child.isMesh)grappleMeshes.push(child);});
    // A stone arch and a small open pavilion give the paths more vertical landmarks.
    const arch=new THREE.Group();arch.position.set(-53,0,-43);arch.userData.parkLandmark='stone-arch';arch.userData.targetable=true;scene.add(arch);
    for(const side of [-1,1]) {
      box(1.3,4.6,2.2,stone,side*3.1,2.3,0,arch);
      box(1.5,.25,2.45,mats.white,side*3.1,4.7,0,arch);
      parkCollider(-53+side*3.1,-43,1.3,2.2,4.8);
    }
    box(7.6,1.1,2.2,stone,0,5.25,0,arch);box(8,.25,2.5,mats.white,0,5.9,0,arch);
    parkCollider(-53,-43,7.6,2.2,6.05,4.7);
    const pavilion=new THREE.Group();pavilion.position.set(-62,0,-150);pavilion.userData.parkLandmark='woodland-pavilion';pavilion.userData.targetable=true;scene.add(pavilion);
    box(8,.35,8,stone,0,.175,0,pavilion);parkCollider(-62,-150,8,8,.35,0,null,true);
    for(const dx of [-3,3])for(const dz of [-3,3]) {
      box(.45,4,.45,stone,dx,2.35,dz,pavilion);parkCollider(-62+dx,-150+dz,.55,.55,4.35);
    }
    const pavilionRoof=new THREE.Mesh(new THREE.ConeGeometry(6,2,4),mats.roof);pavilionRoof.rotation.y=Math.PI/4;pavilionRoof.position.y=5.35;pavilion.add(pavilionRoof);
    parkCollider(-62,-150,8.5,8.5,6.35,4.35);
    for(const group of [arch,pavilion])group.traverse(child=>{if(child.isMesh){child.castShadow=true;grappleMeshes.push(child);}});
    // Glacial-looking rock outcrops break up the wooded edges of the park.
    const rockMat=material(0x7f8279);
    for(const [i,hill] of parkHills.entries()) {
      const [x,z]=hill,groundY=.06+parkElevation(x,z),rock=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),rockMat);
      rock.position.set(x,groundY+.52,z);rock.scale.set(1.8,1.15,1.35);rock.rotation.y=i*.7;rock.castShadow=true;rock.receiveShadow=true;rock.userData.parkLandmark='rock-outcrop';scene.add(rock);
      parkCollider(x,z,3.1,2.4,groundY+1.4,0,'round');grappleMeshes.push(rock);
    }
    const flowerMat=material(0xd7c496),flowers=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),flowerMat,100),flowerTransform=new THREE.Object3D();
    for(let i=0;i<100;i++) {
      const x=-61+random(i*17+2200)*7,z=-90+random(i*31+2201)*45;
      flowerTransform.position.set(x,.16+parkElevation(x,z),z);flowerTransform.scale.set(.1,.12+random(i+15)*.14,.1);flowerTransform.updateMatrix();flowers.setMatrixAt(i,flowerTransform.matrix);
    }
    flowers.count=100;flowers.computeBoundingSphere();scene.add(flowers);
    // Infields, bases and foul lines replace the placeholder squares.
    const infieldMat=material(0xa68870),chalk=material(0xf2eee2);
    for(const [x,z] of [[-31,-8],[-10,-8],[-20,7],[-32,-126],[-10,-126]]) {
      ellipse(x,z,4.3,4.3,infieldMat,.09);
      ellipse(x,z,2.1,2.1,lawnMat,.096);
      for(const [dx,dz] of [[0,-3.1],[3.1,0],[0,3.1],[-3.1,0]]) {
        const base=box(.42,.025,.42,chalk,x+dx,.11,z+dz);base.rotation.y=Math.PI/4;
      }
      for(const side of [-1,1]) {
        const line=box(.06,.02,8.8,chalk,x+side*3.1,.11,z+3.1);line.rotation.y=side*Math.PI/4;
      }
      ellipse(x,z,.35,.35,infieldMat,.105);
    }
    const insideEllipse=(x,z,cx,cz,rx,rz)=>((x-cx)/rx)**2+((z-cz)/rz)**2<1;
    let planted=0;
    for(let i=0;i<600 && planted<150;i++) {
      const x=-70+random(i*17+8)*100,z=-190+random(i*31+19)*380;
      const open=insideEllipse(x,z,-20,-70,37,45)||insideEllipse(x,z,-32,65,31,25)||insideEllipse(x,z,-20,-5,33,26)||insideEllipse(x,z,-20,-126,34,23)||insideEllipse(x,z,-47,126,22,26)||insideEllipse(x,z,4,172,16,12)||insideEllipse(x,z,-4,-169,19,14)||insideEllipse(x,z,-8,34,10,7);
      const drive=Math.abs(((x+20)/49)**2+(z/183)**2-1)<.12;
      if(open||drive||(Math.abs(x-8)<8&&z>81&&z<165)||Math.hypot(x,z-8)<8)continue;
      parkTree(x,z,i+80);planted++;
    }
    // Dense woodland at the northern end, west of Harlem Meer.
    for(let i=0;i<18;i++)parkTree(-68+random(i*43+311)*18,-183+random(i*37+312)*31,2400+i);
    const shrubs=new THREE.InstancedMesh(canopyGeometry,canopyLeaves[0],160),transform=new THREE.Object3D();let shrubsPlaced=0;
    for(let i=0;i<600 && shrubsPlaced<160;i++) {
      const x=-70+random(i*43+801)*100,z=-190+random(i*47+802)*380;
      if(insideEllipse(x,z,-20,-70,38,46)||insideEllipse(x,z,-32,65,32,26)||insideEllipse(x,z,-20,-5,34,27)||insideEllipse(x,z,-20,-126,35,24)||insideEllipse(x,z,-47,126,23,27)||insideEllipse(x,z,-4,-169,19,14)||insideEllipse(x,z,4,172,16,12)||insideEllipse(x,z,-8,34,10,7)||Math.abs(((x+20)/49)**2+(z/183)**2-1)<.12 || (Math.abs(x-8)<8&&z>80&&z<165))continue;
      const size=.28+random(i+804)*.34;transform.position.set(x,.13+parkElevation(x,z),z);transform.scale.set(size,.18+size*.35,size*.8);transform.rotation.y=random(i+805)*Math.PI;transform.updateMatrix();shrubs.setMatrixAt(shrubsPlaced++,transform.matrix);
    }
    shrubs.count=shrubsPlaced;shrubs.receiveShadow=true;scene.add(shrubs);
    for(let z=-170;z<=170;z+=25){bench(-61,z,Math.PI/2);bench(20,z,-Math.PI/2);}
    for(let z=98;z<=154;z+=14){bench(4,z,Math.PI/2);bench(12,z,-Math.PI/2);}
    // Park visitors follow connected circuits around the northern and southern halves.
    for(let i=0;i<24;i++) {
      const north=i<12, x=i%2?-64:24,z=(north?-170:5)+(i%6)*25;
      const person=makePedestrian(x,z,900+i,-80,-200);person.parkWalker=true;person.group.position.y=.1;
      person.route=north?[{x:-64,z:-149},{x:24,z:-149},{x:24,z:-25},{x:-64,z:-25}]:[{x:-64,z:5},{x:24,z:5},{x:24,z:155},{x:-64,z:155}];
      person.target=i%2?0:1;person.direction=i%2?1:-1;
      if(i%5===1)makeDog(person,1200+i);if(i===2||i===14)makeWheelchair(person);
      if(i%7===0)person.speed*=1.35;
    }
  }
  const vendorCanvas=document.createElement('canvas');vendorCanvas.width=256;vendorCanvas.height=96;
  const vc=vendorCanvas.getContext('2d');vc.fillStyle='#e6c27a';vc.fillRect(0,0,256,96);vc.fillStyle='#8b302a';vc.textAlign='center';vc.font='bold 44px sans-serif';vc.fillText('HOT DOGS',128,63);
  const vendorTex=new THREE.CanvasTexture(vendorCanvas);vendorTex.colorSpace=THREE.SRGBColorSpace;
  const vendorSign=new THREE.MeshStandardMaterial({map:vendorTex,roughness:.8,side:THREE.DoubleSide});
  const mustard=material(0xe9b743),sausage=material(0x9d4731),bun=material(0xd7a563);
  function hotDogStand(x,z,seed,blockX,blockZ) {
    const cart=new THREE.Group();cart.position.set(x,inPark(x,z) ? .09 : .45,z);cart.userData.targetable=true;scene.add(cart);
    registerProp(cart,.85,.55,2.9,'food-cart');
    box(1.55,.65,.8,metalTrim,0,.75,0,cart);box(1.65,.1,.9,mats.white,0,1.12,0,cart);
    for(const side of [-.55,.55]){const wheel=new THREE.Mesh(new THREE.TorusGeometry(.20,.04,8,16),rubber);wheel.rotation.y=Math.PI/2;wheel.position.set(side,.2,0);cart.add(wheel);}
    box(.07,1.5,.07,metalTrim,0,1.9,0,cart);
    for(let i=0;i<8;i++){const roof=new THREE.Mesh(new THREE.ConeGeometry(1.25,.48,4,1,false,i*Math.PI/4,Math.PI/4),i%2?mats.white:awning);roof.position.y=2.76;cart.add(roof);}
    const label=new THREE.Mesh(new THREE.PlaneGeometry(1.3,.42),vendorSign);label.position.set(0,.78,-.42);label.rotation.y=Math.PI;cart.add(label);
    for(let i=-1;i<=1;i++){const roll=oval(cart,bun,i*.37,1.22,0,.15,.07,.25);const dog=oval(cart,sausage,i*.37,1.28,0,.055,.05,.21);}
    const vendor=makePedestrian(x,z+.95,seed,blockX,blockZ,'vendor');vendor.settled=true;vendor.vendor=true;vendor.group.rotation.y=0;if(inPark(x,z))vendor.group.position.y=.09;
  }
  let featuredHydrant=null;
  const hydrants=[];
  const trashCanGeometry=new THREE.CylinderGeometry(.28,.24,.65,12),coneGeometry=new THREE.ConeGeometry(.28,.8,8);
  function streetDetails(x,z,seed) {
    if(random(seed+301)>.63){const hydrant=new THREE.Group();hydrant.position.set(x+6.25,.45,z+9);hydrant.userData.targetable=true;scene.add(hydrant);hydrants.push(hydrant);const body=new THREE.Mesh(new THREE.CylinderGeometry(.16,.19,.55,12),fireRed);body.position.y=.28;hydrant.add(body);const cap=new THREE.Mesh(new THREE.SphereGeometry(.16,12,8),fireRed);cap.position.y=.57;hydrant.add(cap);box(.48,.12,.12,fireRed,0,.36,0,hydrant);if(!featuredHydrant || hydrant.position.lengthSq()<featuredHydrant.position.lengthSq())featuredHydrant=hydrant;}
    if(random(seed+302)>.7){const bin=new THREE.Group();bin.position.set(x+6.3,.45,z-9);scene.add(bin);const body=new THREE.Mesh(trashCanGeometry,parkMetal);body.position.y=.33;bin.add(body);registerProp(bin,.3,.3,.7,'trash-can');}
    if(random(seed+304)>.91){const cone=new THREE.Group();cone.position.set(x+5.8,.45,z-13);scene.add(cone);const body=new THREE.Mesh(coneGeometry,roleRed);body.position.y=.4;cone.add(body);box(.48,.06,.48,roleDark,0,.03,0,cone);registerProp(cone,.28,.28,.8,'cone');}
    if(random(seed+303)>.82)bench(x+7,z+14,Math.PI/2);
  }
  window.installFeaturedHydrant = model => {
    if (!featuredHydrant) return;
    while (featuredHydrant.children.length) featuredHydrant.remove(featuredHydrant.children[0]);
    model.position.x=.3;
    featuredHydrant.add(model);
  };
  makePark();
  hotDogStand(7,-12,1301,-40,-40);
  // A small marching group follows neighboring loops and keeps its signs in hand.
  const protestMaterials=['OUR CITY','CITY VOICES','COMMUNITY'].map(message=>{
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#e8dfc9';ctx.fillRect(0,0,512,256);
    ctx.strokeStyle='#9e7051';ctx.lineWidth=12;ctx.strokeRect(6,6,500,244);
    ctx.fillStyle='#442f2a';ctx.textAlign='center';ctx.textBaseline='middle';
    if(message==='COMMUNITY'){ctx.font='bold 62px sans-serif';ctx.fillText('COMMUNITY',256,128);}
    else {ctx.font='bold 65px sans-serif';const words=message.split(' ');ctx.fillText(words[0],256,88);ctx.fillText(words[1],256,166);}
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({map:texture,roughness:1,side:THREE.FrontSide});
  });
  function makeProtest() {
    for(let i=0;i<9;i++) {
      const column=i%3,row=Math.floor(i/3),ox=(column-1)*1.5,oz=row*1.6;
      const person=makePedestrian(15+ox,4+oz,7700+i,-40,-40,'protester');
      person.protester=true;person.parkWalker=true;person.group.position.y=.1+parkElevation(person.group.position.x,person.group.position.z);
      person.route=[{x:15+ox,z:4+oz},{x:15+ox,z:-24+oz},{x:23+ox,z:-24+oz},{x:23+ox,z:4+oz}];
      person.target=1;person.direction=1;person.speed=1.25;person.pause=0;
      box(.055,1.45,.055,woodMat,0,.22,-.13,person.rightArm);
      const signGeometry=new THREE.PlaneGeometry(1.35,.68),signMaterial=protestMaterials[i%protestMaterials.length];
      for(const side of [-1,1]) {
        const sign=new THREE.Mesh(signGeometry,signMaterial);
        sign.position.set(0,1.1,-.13+side*.04);if(side<0)sign.rotation.y=Math.PI;
        person.rightArm.add(sign);
      }
    }
  }
  makeProtest();
  function bicycle(x,z,angle) {
    const bike=new THREE.Group();bike.position.set(x,.45,z);bike.rotation.y=angle;bike.userData.targetable=true;scene.add(bike);
    for(const wheelX of [-.58,.58]){const wheel=new THREE.Mesh(new THREE.TorusGeometry(.38,.035,8,20),rubber);wheel.position.set(wheelX,.4,0);bike.add(wheel);}
    beamBetween(bike,[-.58,.4,0],[0,.79,0],.035,metalTrim);beamBetween(bike,[0,.79,0],[.58,.4,0],.035,metalTrim);
    beamBetween(bike,[-.58,.4,0],[.3,.4,0],.035,metalTrim);beamBetween(bike,[.3,.4,0],[0,.79,0],.035,metalTrim);
    box(.28,.06,.12,shoeMat,-.05,.85,0,bike);box(.3,.05,.05,metalTrim,.62,.9,0,bike);
  }
  const streetLamps=[];
  function streetCorner(i,j) {
    const x=i*40,z=j*40,seed=i*83+j*47;
    const parkIntersection=inPark(x,z), midBlock=joinedBlock(x,z+20) && joinedBlock(x,z-20);
    if(!parkIntersection && !midBlock) {
      for(let n=-2;n<=2;n++) {
        if(!nearCurvedRoad(x+n*2.1,z-7,8))box(1.6,.035,.55,mats.line,x+n*2.1,.03,z-7);
        if(!nearCurvedRoad(x-7,z+n*2.1,8))box(.55,.035,1.6,mats.line,x-7,.03,z+n*2.1);
      }
      if(!nearCurvedRoad(x+6.5,z+6.5,7)) {
        const lamp=new THREE.Group();lamp.position.set(x+6.5,0,z+6.5);lamp.userData.targetable=true;scene.add(lamp);
        const pole=box(.16,5,.16,lampMat,0,2.5,0,lamp);pole.castShadow=true;
        box(1.4,.12,.14,lampMat,-.6,5,0,lamp);box(.45,.1,.3,mats.white,-1.2,4.95,0,lamp);streetLamps.push(lamp);
      }
      if(random(i*31+j*69)>.35 && !inPark(x+6.4,z+15) && !nearCurvedRoad(x+6.4,z+15,9))tree(x+6.4,z+15,i*17+j*29);
      if(!inPark(x+6.4,z+12) && !nearCurvedRoad(x+6.4,z+12,10)) {
        streetDetails(x,z,seed);
        if(random(seed+75)>.94 || (i===1&&j===0) || (i===-3&&j===-1))hotDogStand(x+6.4,z+12,seed+300,x,z);
        if(random(seed+94)>.92)bicycle(x+6.4,z-10,Math.PI/2);
        if(random(seed)>.27) {
          const person=makePedestrian(x+6.4,z+12,seed,x,z);
          if(random(seed+33)>.84)makeDog(person,seed+800);
          else if(random(seed+55)>.91)makeWheelchair(person);
        }
        // Busy neighborhoods get extra walkers spread around the block.
        const district=districtAt(x+20,z+20),extra=district==='midtown'||district==='fidi'?3:district==='village'||district==='downtown-brooklyn'||district==='uptown'?2:1;
        for(let k=0;k<extra;k++) {
          const edge=Math.floor(random(seed+900+k*7)*4),f=.1+random(seed+930+k*11)*.8;
          const px=edge===0?x+6.4+f*27.2:edge===1?x+33.6:edge===2?x+33.6-f*27.2:x+6.4,pz=edge===0?z+6.4:edge===1?z+6.4+f*27.2:edge===2?z+33.6:z+33.6-f*27.2;
          if(inPark(px,pz) || waterAt(px,pz) || nearCurvedRoad(px,pz,5) || px>worldMaxX-2 || pz>worldMaxZ-2)continue;
          const walker=makePedestrian(px,pz,seed*7+k*131+5,x,z);walker.target=walker.direction===1?(edge+1)%4:edge;
        }
      }
    }
    // The two north-south streets that would cross the park are closed to traffic.
    if(i!==-1 && i!==0 && (Math.abs(i)%2===0 || i===1) && random(i*53+j*97)>.38) {
      const kind=random(seed+501);
      if(kind>.88)cityVehicle(x+2,z+14,seed,'bus');
      else if(kind>.67)cityVehicle(x+2,z+14,seed,'van');
      else if(kind>.5)cityVehicle(x+2,z+14,seed,'pickup');
      else parkedCar(x+2,z+14,i+j);
    }
    if((i===1&&j===-2))fireTruck(x-2,z+14,i*31+j);
    if((i===1&&j===-1)||(i===-3&&j===1)||(i===2&&j===0)||(i===1&&j===3))makeShelter(x+6.4,z+21,i*37+j*19,x,z);
  }
  for(let i=-5;i<=5;i++)for(let j=-17;j<=23;j++)streetCorner(i,j);
  for(let i=9;i<=19;i++)for(let j=11;j<=26;j++)if(!(i===9&&j===19))streetCorner(i,j);
  // Cars take each avenue in one direction and return along the ordinary streets.
  for(const road of curvedRoads) {
    const first=road.samples[0],last=road.samples[road.samples.length-1];
    const corner=new THREE.Vector3(first.x,0,last.z),path=new THREE.CurvePath();
    path.add(road.curve);path.add(new THREE.LineCurve3(last,corner));path.add(new THREE.LineCurve3(corner,first));
    for(const offset of [.08,.42,.75]) {
      const point=path.getPointAt(offset),car=parkedCar(point.x,point.z,2100+offset*100+first.x);
      car.curvedRoute=path;car.routeLength=path.getLength();car.routeProgress=offset;
      const tangent=path.getTangentAt(offset);car.group.rotation.y=Math.atan2(-tangent.x,-tangent.z);
    }
  }
  window.installCityVehicle=(kind,model)=>{
    const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    if(!size.x || !size.y || !size.z)return;
    for(const car of cars) {
      if(car.modelKind!==kind)continue;
      const visual=model.clone(true);
      // Kenney vehicles face +Z; traffic actors face -Z.
      const wrapper=new THREE.Group();wrapper.rotation.y=Math.PI;
      wrapper.scale.set(car.hx*1.8/size.x,car.top*.93/size.y,car.hz*1.8/size.z);
      visual.position.set(-center.x,-bounds.min.y,-center.z);wrapper.add(visual);
      for(const child of car.originalVisual)child.removeFromParent();
      car.originalVisual=[];(car.visualRoot||car.group).add(wrapper);
    }
  };
  window.installStreetLamp=model=>{
    const bounds=new THREE.Box3().setFromObject(model),height=bounds.max.y-bounds.min.y;
    if(!height)return;
    // One instanced batch per lamp part keeps hundreds of lamps to a few draw calls.
    model.updateMatrixWorld(true);
    const base=new THREE.Matrix4().compose(new THREE.Vector3(0,-bounds.min.y*5/height,0),new THREE.Quaternion(),new THREE.Vector3(5/height,5/height,5/height));
    const lampMatrix=new THREE.Matrix4();
    model.traverse(part=>{
      if(!part.isMesh)return;
      const batch=new THREE.InstancedMesh(part.geometry,part.material,streetLamps.length);batch.castShadow=true;
      streetLamps.forEach((lamp,i)=>{lamp.updateMatrix();lampMatrix.multiplyMatrices(lamp.matrix,base).multiply(part.matrixWorld);batch.setMatrixAt(i,lampMatrix);});
      batch.computeBoundingSphere();scene.add(batch);
    });
    for(const lamp of streetLamps)while(lamp.children.length)lamp.remove(lamp.children[0]);
  };
  window.installSuburbModel=(variant,model)=>{
    const mesh=model.children.find(child=>child.isMesh),houses=buildings.filter(b=>b.suburb && b.modelVariant===variant);
    if(!mesh || !houses.length)return;
    const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    if(!size.x || !size.y || !size.z)return;
    const batch=new THREE.InstancedMesh(mesh.geometry,mesh.material,houses.length),transform=new THREE.Object3D();
    const hidden=new THREE.Matrix4().makeTranslation(0,-10000,0);
    batch.userData.structures=[];batch.castShadow=true;batch.receiveShadow=true;
    houses.forEach((house,index)=>{
      transform.scale.set(house.w*.92/size.x,house.height/size.y,house.d*.92/size.z);
      transform.position.set(house.x-center.x*transform.scale.x,.15-bounds.min.y*transform.scale.y,house.z-center.z*transform.scale.z);
      transform.updateMatrix();const matrix=transform.matrix.clone();
      for(const part of house.parts) {
        part.visible=false;part.userData.modelReplaced=true;
        part.traverse(child=>{const i=grappleMeshes.indexOf(child);if(i>=0)grappleMeshes.splice(i,1);});
      }
      for(const part of house.instanceParts){part.batch.setMatrixAt(part.index,hidden);part.batch.instanceMatrix.needsUpdate=true;}
      house.instanceParts=[{batch,index,matrix}];batch.userData.structures[index]=house;
      batch.setMatrixAt(index,house.destroyed?hidden:matrix);
    });
    batch.computeBoundingSphere();scene.add(batch);grappleMeshes.push(batch);
  };
  window.installDogModel=(model,clips,clone)=>{
    const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    const idle=THREE.AnimationClip.findByName(clips,'idle'),walk=THREE.AnimationClip.findByName(clips,'walk');
    if(!size.y || !idle || !walk)return;
    for(const dog of dogs) {
      const visual=clone(model),wrapper=new THREE.Group(),scale=.82/size.y;
      wrapper.rotation.y=Math.PI;wrapper.scale.setScalar(scale);
      // The animated corgi's feet are at its origin; bind-pose bounds extend below them.
      visual.position.set(-center.x,0,-center.z);wrapper.add(visual);
      while(dog.group.children.length)dog.group.remove(dog.group.children[0]);dog.group.add(wrapper);
      dog.mixer=new THREE.AnimationMixer(visual);
      dog.idleAction=dog.mixer.clipAction(idle);dog.walkAction=dog.mixer.clipAction(walk);
      dog.idleAction.play();dog.dogWalking=false;
    }
  };
  window.installTrafficLights=model=>{
    const bounds=new THREE.Box3().setFromObject(model),height=bounds.max.y-bounds.min.y;
    if(!height)return;
    for(let i=0;i<streetLamps.length;i+=10) {
      const lamp=streetLamps[i],signal=new THREE.Group(),visual=model.clone(true),scale=4.2/height;
      signal.position.set(lamp.position.x,lamp.position.y,lamp.position.z+1.3);signal.userData.targetable=true;
      visual.scale.setScalar(scale);visual.position.y=-bounds.min.y*scale;signal.add(visual);scene.add(signal);
    }
  };
  // Compact NYC-inspired destinations occupy their own reserved city blocks.
  function plazaVisitors(cx,cz,rx,rz,count,seed) {
    const route=[{x:cx-rx,z:cz-rz},{x:cx+rx,z:cz-rz},{x:cx+rx,z:cz+rz},{x:cx-rx,z:cz+rz}];
    for(let i=0;i<count;i++) {
      const corner=i%4,start=route[corner],person=makePedestrian(start.x,start.z,seed+i,Math.floor(cx/40)*40,Math.floor(cz/40)*40);
      person.group.position.y=.14;person.parkWalker=true;person.route=route;person.target=(corner+1)%4;person.direction=1;person.pause=random(seed+i)*1.5;
      if(i===1)makeDog(person,seed+200);else if(i===3)makeWheelchair(person);
    }
  }
  function displayMaterial(title,subtitle,color) {
    const image=document.createElement('canvas');image.width=512;image.height=256;const c=image.getContext('2d');
    const grad=c.createLinearGradient(0,0,512,256);grad.addColorStop(0,color);grad.addColorStop(1,'#141b38');c.fillStyle=grad;c.fillRect(0,0,512,256);
    c.fillStyle='rgba(255,255,255,.12)';for(let x=-128;x<640;x+=70){c.beginPath();c.moveTo(x,0);c.lineTo(x+140,0);c.lineTo(x+10,256);c.lineTo(x-130,256);c.closePath();c.fill();}
    c.textAlign='center';c.fillStyle='#fff';c.font='bold 72px sans-serif';c.fillText(title,256,122);c.font='bold 27px sans-serif';c.fillText(subtitle,256,185);
    const texture=new THREE.CanvasTexture(image);texture.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});
  }
  const plazaDisplays=[displayMaterial('NYC','THE CITY THAT MOVES','#e14c55'),displayMaterial('BROADWAY','LIGHTS  /  MUSIC  /  STORIES','#435fc2'),displayMaterial('SKYLINE','LOOK UP','#c58d3e')];
  const stepRed=material(0xaf292e),plazaStone=material(0x8f9695);
  function makeTheaterPlaza() {
    const area=new THREE.Group();area.position.set(60,0,220);area.userData.interestKind='theater-plaza';area.userData.targetable=true;scene.add(area);
    box(30,.14,30,plazaStone,0,.07,0,area);
    for(let i=0;i<6;i++)box(8,.3,.8,stepRed,0,.15+i*.3,4-i*.8,area);
    box(8,.2,1,stepRed,0,1.95,-.35,area);
    for(const [x,z,angle,kind] of [[-10,-12,0,0],[10,-12,0,1],[-10,12,Math.PI,2],[10,12,Math.PI,0]]) {
      const sign=new THREE.Group();sign.position.set(x,0,z);sign.rotation.y=angle;area.add(sign);
      box(.65,19,.65,metal,0,9.5,0,sign);box(8.4,5.3,.3,metal,0,15.3,0,sign);
      const screen=new THREE.Mesh(new THREE.PlaneGeometry(8,5),plazaDisplays[kind]);screen.position.set(0,15.3,.17);sign.add(screen);
      box(7.8,.14,.18,mats.white,0,18,.19,sign);
    }
    const light=new THREE.PointLight(0xff7770,20,35);light.position.set(0,13,0);area.add(light);
    area.traverse(child=>{if(child.isMesh)grappleMeshes.push(child);});
    for(const [x,z] of [[49,218],[71,218]])bench(x,z,Math.PI/2);
    plazaVisitors(60,220,11,10,8,3000);
    const subway=new THREE.Group();subway.position.set(47,.14,209);subway.userData.targetable=true;scene.add(subway);
    box(3,.12,2.2,lampMat,0,.06,0,subway);
    for(const side of [-1,1]){box(.09,1.1,.09,parkMetal,side*1.4,.55,0,subway);box(.09,.09,2,parkMetal,side*1.4,1.1,0,subway);}
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(2,.45),displayMaterial('SUBWAY','', '#176b4c'));sign.position.set(0,1.35,-.95);sign.rotation.y=Math.PI;subway.add(sign);
  }
  function makeWashingtonSquare() {
    const area=new THREE.Group();area.position.set(20,0,540);area.userData.interestKind='washington-square';area.userData.targetable=true;scene.add(area);
    box(30,.12,30,pathMat,0,.06,0,area);
    const arch=new THREE.Group();arch.position.set(0,0,-10);area.add(arch);
    for(const side of [-1,1]) {
      const pier=box(2.5,10,2.6,stone,side*5.25,5,0,arch);grappleMeshes.push(pier);
      box(3,.4,3,mats.white,side*5.25,.2,0,arch);box(3,.4,3,mats.white,side*5.25,10,0,arch);
      const collider={x:20+side*5.25,z:530,w:2.5,d:2.6,height:10};buildings.push(collider);playerBuildingColliders.push(collider);
    }
    const cap=box(13.5,2.4,2.8,stone,0,11.2,0,arch);grappleMeshes.push(cap);
    box(14,.35,3.1,mats.white,0,12.55,0,arch);
    const lintel={x:20,z:530,w:13.5,d:2.8,bottom:10,height:12.7};upperBuildingColliders.push(lintel);playerBuildingColliders.push(lintel);
    for(const face of [-1.36,1.36]){const molding=new THREE.Mesh(new THREE.TorusGeometry(4,.25,8,32,Math.PI),mats.white);molding.position.set(0,6,face);arch.add(molding);grappleMeshes.push(molding);}
    const rim=new THREE.Mesh(new THREE.CylinderGeometry(4.4,4.7,.38,40),stone);rim.position.set(0,.2,1);area.add(rim);
    const pool=new THREE.Mesh(new THREE.CylinderGeometry(4,4,.08,40),waterMat);pool.position.set(0,.44,1);area.add(pool);
    const center=new THREE.Mesh(new THREE.CylinderGeometry(.3,.55,1.1,16),stone);center.position.set(0,.96,1);area.add(center);
    for(const [x,z] of [[-11,-9],[11,-9],[-11,9],[11,9]]){parkTree(20+x,540+z,4100+x*7+z,.12,true);bench(20+x,540+z+(z>0?-2:2),0);}
    plazaVisitors(20,540,10,10,7,4100);
  }
  const harborBoats=[];
  function makeWaterfront() {
    const area=new THREE.Group();area.userData.interestKind='waterfront';area.userData.targetable=true;scene.add(area);
    // Opaque harbor surface hides the street plane beneath the water.
    const shorelineWater=harborWater.clone();shorelineWater.transparent=false;shorelineWater.opacity=1;shorelineWater.depthWrite=true;
    // A continuous promenade replaces the old short strip of isolated pavement.
    box(2700,.08,400,shorelineWater,1579,.02,0,area);
    box(29,.12,389,mats.sidewalk,214.5,.06,0,area);
    box(.45,.42,389,stone,229,.18,0,area);
    for(let z=-192;z<=188;z+=4) {
      if((z>=16&&z<=28)||(z>=-60&&z<=-52)||(z>=104&&z<=112))continue;
      box(.1,1,.1,metalTrim,229,.62,z,area);box(.1,.08,4,metalTrim,229,1.12,z+2,area);
      playerBuildingColliders.push({x:229,z:z+2,w:.2,d:4,height:1.16});
    }
    for(let z=-174;z<=174;z+=24) {
      if(Math.abs(z-22)<11||Math.abs(z+54)<10||Math.abs(z-110)<10)continue;
      bench(216,z,Math.PI/2);parkTree(205,z+5,5200+z,.12,true);
      const lamp=new THREE.Group();lamp.position.set(224,.12,z);lamp.userData.targetable=true;area.add(lamp);
      box(.16,5,.16,metalTrim,0,2.5,0,lamp);box(1,.12,.14,metalTrim,-.45,5,0,lamp);box(.4,.1,.3,mats.white,-.85,4.95,0,lamp);
    }
    // The suspension bridge leads to a small public island, not an abrupt dead end.
    const bridge=new THREE.Group();bridge.position.set(206,.08,22);bridge.userData.interestKind='waterfront-bridge';bridge.userData.targetable=true;scene.add(bridge);
    box(50,.28,7,plazaStone,25,.14,0,bridge);
    box(28,.28,7,plazaStone,64,.14,0,bridge);
    box(44,.42,36,plazaStone,93,.21,0,bridge);
    const paving=[];
    for(let x=71;x<=115;x+=2.75)paving.push(x,.435,-18,x,.435,18);
    for(let z=-18;z<=18;z+=3)paving.push(71,.435,z,115,.435,z);
    const pavingGeometry=new THREE.BufferGeometry();pavingGeometry.setAttribute('position',new THREE.Float32BufferAttribute(paving,3));
    bridge.add(new THREE.LineSegments(pavingGeometry,new THREE.LineBasicMaterial({color:0x909b97,transparent:true,opacity:.55})));
    for(const [x,z] of [[80,-12],[106,-12],[80,12],[106,12]]) {
      box(3.3,.55,2,stone,x,.72,z,bridge);box(3.05,.12,1.75,foliage,x,1.06,z,bridge);
      for(let i=-1;i<=1;i++)oval(bridge,parkLeaves[(i+2)%parkLeaves.length],x+i*.8,1.34,z,.48,.4,.45);
    }
    playerBuildingColliders.push({x:245,z:22,w:78,d:7,bottom:-.5,height:.36,walkable:true});
    playerBuildingColliders.push({x:299,z:22,w:44,d:36,bottom:-.5,height:.5,walkable:true});
    for(const tx of [10,38]) {
      for(const side of [-1,1]) {
        box(2,18,1.35,stone,tx,9,side*2.75,bridge);
        const collider={x:206+tx,z:22+side*2.75,w:2,d:1.35,height:18.1};buildings.push(collider);playerBuildingColliders.push(collider);
      }
      box(2,2,7.4,stone,tx,18,0,bridge);box(2.3,.35,7.8,mats.white,tx,19.2,0,bridge);
      const lintel={x:206+tx,z:22,w:2,d:7.4,bottom:17,height:19.4};upperBuildingColliders.push(lintel);playerBuildingColliders.push(lintel);
    }
    for(const side of [-1,1]) {
      const zz=side*3.1,curves=[new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,1,zz),new THREE.Vector3(5,7,zz),new THREE.Vector3(10,19,zz)),new THREE.QuadraticBezierCurve3(new THREE.Vector3(10,19,zz),new THREE.Vector3(24,4,zz),new THREE.Vector3(38,19,zz)),new THREE.QuadraticBezierCurve3(new THREE.Vector3(38,19,zz),new THREE.Vector3(44,7,zz),new THREE.Vector3(50,1,zz))];
      for(const curve of curves)bridge.add(new THREE.Mesh(new THREE.TubeGeometry(curve,24,.085,6,false),metalTrim));
      for(let x=12;x<=36;x+=3){const t=(x-10)/28,y=19*(1-t)*(1-t)+8*t*(1-t)+19*t*t;beamBetween(bridge,[x,.38,zz],[x,y,zz],.035,cableMat);}
      box(78,.08,.1,metalTrim,39,1.05,zz,bridge);
      for(let x=52;x<=76;x+=4)box(.1,1,.1,metalTrim,x,.55,zz,bridge);
    }
    for(const side of [-1,1]) {
      box(44,.1,.12,metalTrim,93,1.1,side*17.6,bridge);
      for(let x=72;x<=114;x+=4)box(.12,1,.12,metalTrim,x,.6,side*17.6,bridge);
    }
    box(.12,.1,36,metalTrim,114.8,1.1,0,bridge);
    for(let z=-16;z<=16;z+=4)box(.12,1,.12,metalTrim,114.8,.6,z,bridge);
    bridge.traverse(child=>{if(child.isMesh)grappleMeshes.push(child);});
    parkTree(292,10,54011,.5,true);parkTree(309,34,54012,.5,true);
    bench(291,31,0);bench(307,13,Math.PI);
    plazaVisitors(299,22,12,8,6,54020);
    for(const visitor of pedestrians.slice(-6))visitor.group.position.y=.5;
    // A working waterfront pier extends from the promenade into the harbor.
    const wharf=new THREE.Group();wharf.position.set(226,0,-54);wharf.userData.interestKind='wharf';wharf.userData.targetable=true;scene.add(wharf);
    box(31,.3,8,woodMat,15.5,.28,0,wharf);
    for(let x=1;x<31;x+=1.2)box(.05,.03,7.9,stone,x,.44,0,wharf);
    for(const side of [-1,1]) {
      for(let x=2;x<=30;x+=4)box(.25,1.35,.25,woodMat,x,.67,side*3.85,wharf);
      box(29,.12,.12,woodMat,16,1.15,side*3.85,wharf);
      playerBuildingColliders.push({x:242,z:-54+side*3.85,w:29,d:.25,height:1.15});
    }
    playerBuildingColliders.push({x:241.5,z:-54,w:31,d:8,height:.43,walkable:true});
    for(const [x,z] of [[8,-2.4],[11,-2.4],[22,2.3]]) {
      box(1.2,1.2,1.2,woodMat,x,1.07,z,wharf);box(1.3,.12,1.3,stone,x,1.72,z,wharf);
      playerBuildingColliders.push({x:226+x,z:-54+z,w:1.3,d:1.3,height:1.8});
    }
    wharf.traverse(child=>{if(child.isMesh){child.castShadow=true;grappleMeshes.push(child);}});
    const fisher=makePedestrian(249,-54,5301,240,-80);fisher.settled=true;fisher.group.position.y=.43;fisher.group.rotation.y=-Math.PI/2;
    const rod=box(.05,3.3,.05,woodMat,0,-.4,-.5,fisher.rightArm);rod.rotation.x=-.9;
    // A second pier gives the southern promenade a place to stroll and fish.
    const pier=new THREE.Group();pier.position.set(226,0,110);pier.userData.interestKind='waterfront-pier';pier.userData.targetable=true;scene.add(pier);
    box(31,.3,8,woodMat,15.5,.28,0,pier);
    for(let x=1;x<31;x+=1.2)box(.05,.03,7.9,stone,x,.44,0,pier);
    for(const side of [-1,1]) {
      for(let x=2;x<=30;x+=4)box(.25,1.35,.25,woodMat,x,.67,side*3.85,pier);
      box(29,.12,.12,woodMat,16,1.15,side*3.85,pier);
      playerBuildingColliders.push({x:242,z:110+side*3.85,w:29,d:.25,height:1.15});
    }
    playerBuildingColliders.push({x:241.5,z:110,w:31,d:8,height:.43,walkable:true});
    for(const x of [8,20,28]) {
      const bollard=new THREE.Mesh(new THREE.CylinderGeometry(.18,.24,.6,10),metalTrim);bollard.position.set(x,.7,2.6);pier.add(bollard);
    }
    pier.traverse(child=>{if(child.isMesh){child.castShadow=true;grappleMeshes.push(child);}});
    const pierVisitor=makePedestrian(245,110,5302,240,80);pierVisitor.settled=true;pierVisitor.group.position.y=.43;pierVisitor.group.rotation.y=-Math.PI/2;
    plazaVisitors(211,-145,5,32,5,5400);
    plazaVisitors(211,145,5,32,5,5500);
    plazaVisitors(211,-15,5,30,6,5200);
    const boat=new THREE.Group();boat.position.set(244,.14,-30);boat.userData.targetable=true;boat.userData.interestKind='harbor-boat';scene.add(boat);
    box(4,.45,8,stone,0,.3,0,boat);box(3,1.2,3.3,mats.white,0,1.1,.3,boat);box(2.6,.45,.1,carGlass,0,1.35,-1.4,boat);box(2.5,.12,2.8,metalTrim,0,1.75,.3,boat);
    harborBoats.push(boat);
  }
  makeTheaterPlaza();makeWashingtonSquare();makeWaterfront();
  // ---- New York landmarks ----
  const bridgeStone=material(0x9e927d),bridgeDeck=material(0x4b4a46),copper=new THREE.MeshStandardMaterial({color:0x6fa591,roughness:.62,metalness:.25});
  const torchFlame=new THREE.MeshBasicMaterial({color:0xffc35a}),bronze=new THREE.MeshStandardMaterial({color:0x6b4a2e,roughness:.4,metalness:.7});
  const cableLine=new THREE.LineBasicMaterial({color:0x8d8a80,transparent:true,opacity:.8});
  function collider(x,z,w,d,bottom,height,walkable=false) {const c={x,z,w,d,bottom,height,walkable};playerBuildingColliders.push(c);return c;}
  // Brooklyn Bridge: stone anchorages and two gothic towers carry a walkable deck over the East River.
  function makeBrooklynBridge() {
    const deckY=13,west=246,east=380,rampEnd=436,z=bridgeZ;
    const deck=box(east-west,.6,12,bridgeDeck,(west+east)/2,deckY-.3,z);deck.receiveShadow=true;grappleMeshes.push(deck);
    collider((west+east)/2,z,east-west,12,deckY-1,deckY,true);
    for(const side of [-1,1])box(east-west,.9,.15,metal,(west+east)/2,deckY+.45,z+side*6);
    // Both approaches have shallow, walkable steps that join the street.
    const steps=40,westRampStart=198;
    for(let i=0;i<steps;i++) {
      const x0=westRampStart+(west-westRampStart)*i/steps,x1=westRampStart+(west-westRampStart)*(i+1)/steps,y=deckY*(i+1)/steps;
      const step=box(x1-x0+.05,.5,12,bridgeDeck,(x0+x1)/2,y-.25,z);step.receiveShadow=true;collider((x0+x1)/2,z,x1-x0,12,y-.8,y,true);
    }
    for(let i=0;i<steps;i++) {
      const x0=east+(rampEnd-east)*i/steps,x1=east+(rampEnd-east)*(i+1)/steps,y=deckY*(1-(i+1)/steps)+.45;
      const step=box(x1-x0+.05,.5,12,bridgeDeck,(x0+x1)/2,y-.25,z);step.receiveShadow=true;collider((x0+x1)/2,z,x1-x0,12,y-.8,y,true);
    }
    for(const [x,w] of [[west+8,16],[east-6,12]])for(const side of [-1,1]) {
      // Split the anchorage around the roadway instead of walling the deck off.
      const pierZ=z+side*8,anchorage=box(w,deckY+1.5,4,bridgeStone,x,(deckY+1.5)/2-.75,pierZ);
      anchorage.castShadow=true;grappleMeshes.push(anchorage);
      buildings.push({x,z:pierZ,w,d:4,height:deckY+.75});collider(x,pierZ,w,4,-2,deckY+.75,true);
    }
    for(const tx of [286,342]) {
      for(const side of [-1,1]) {
        const pier=box(7,46,5.5,bridgeStone,tx,21,z+side*9.25);pier.castShadow=true;grappleMeshes.push(pier);collider(tx,z+side*9.25,7,5.5,-2,44);
      }
      const top=box(7.6,10,24,bridgeStone,tx,39,z);top.castShadow=true;grappleMeshes.push(top);collider(tx,z,7.6,24,34,44,true);
      box(8.2,.8,25,mats.white,tx,44.4,z);
      for(const face of [-1,1])for(const side of [-1,1]) {
        // Pointed arch windows give the towers their gothic silhouette.
        const arch=box(.3,9,3,darkGlass,tx+face*3.85,26,z+side*3.6);arch.rotation.x=0;
        const point=box(.32,2.6,2.2,darkGlass,tx+face*3.86,31.6,z+side*3.6);point.rotation.x=Math.PI/4;
      }
    }
    // Main cables sag between the towers; suspenders and stays drop to the deck.
    const span=(x)=>{if(x<286)return 16+(x-west)/(286-west)*28;if(x>342)return 44-(x-342)/(east-342)*28;const t=(x-314)/28;return deckY+3+29*t*t;};
    const suspenders=[];
    for(const side of [-1,1]) {
      const points=[];for(let x=west;x<=east;x+=4)points.push(new THREE.Vector3(x,span(x),z+side*6.6));
      const cable=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),80,.28,6),metal);cable.castShadow=true;scene.add(cable);grappleMeshes.push(cable);
      for(let x=west+4;x<east;x+=3)suspenders.push(x,span(x),z+side*6.6,x,deckY,z+side*6.2);
      for(const tx of [286,342])for(let k=1;k<=8;k++)for(const dir of [-1,1])suspenders.push(tx,40,z+side*6.6,tx+dir*k*4.5,deckY,z+side*6.2);
    }
    const lines=new THREE.BufferGeometry();lines.setAttribute('position',new THREE.Float32BufferAttribute(suspenders,3));
    const web=new THREE.LineSegments(lines,cableLine);web.userData.projectile=true;web.raycast=()=>{};scene.add(web);
  }
  // Liberty Island sits in the harbor south of the Battery.
  function makeStatueOfLiberty() {
    const site=new THREE.Group();site.position.set(-150,0,1215);site.userData.targetable=true;scene.add(site);
    box(70,1.2,60,material(0x5f7a53),0,-.3,0,site);
    collider(-150,1215,70,60,-1,.3,true);
    collider(-150,1215,34,34,0,6,true);
    collider(-150,1215,18,18,6,37,true);
    const stoneCanvas=document.createElement('canvas');stoneCanvas.width=256;stoneCanvas.height=128;const ctx=stoneCanvas.getContext('2d');
    ctx.fillStyle='#b7a994';ctx.fillRect(0,0,256,128);ctx.strokeStyle='rgba(71,66,58,.28)';ctx.lineWidth=2;
    for(let y=0;y<=128;y+=16){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();for(let x=(y%32?0:32);x<=256;x+=64){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+16);ctx.stroke();}}
    const stoneTexture=new THREE.CanvasTexture(stoneCanvas);stoneTexture.colorSpace=THREE.SRGBColorSpace;stoneTexture.wrapS=stoneTexture.wrapT=THREE.RepeatWrapping;stoneTexture.repeat.set(4,2);
    const fortMaterial=new THREE.MeshStandardMaterial({map:stoneTexture,color:0xf0e5d4,roughness:.94});
    for(let i=0;i<5;i++){const fort=box(34,6,34,fortMaterial,0,3,0,site);fort.rotation.y=i*Math.PI*2/10;}
    box(16,24,16,fortMaterial,0,18,0,site);box(18,1.2,18,mats.white,0,30.6,0,site);box(12,6,12,fortMaterial,0,33.8,0,site);
    for(const side of [-1,1])for(const offset of [-5,0,5]) {
      box(2.2,3.5,.1,darkGlass,offset,12,side*8.06,site);box(.1,3.5,2.2,darkGlass,side*8.06,12,offset,site);
    }
    for(let i=0;i<4;i++) {const ledge=box(35,.35,35,stone,0,5.9,0,site);ledge.rotation.y=i*Math.PI/10;}
    const robe=new THREE.Mesh(new THREE.CylinderGeometry(2.6,4.6,26,14),copper);robe.position.y=49.8;site.add(robe);
    const shoulders=new THREE.Mesh(new THREE.SphereGeometry(3.1,14,10),copper);shoulders.position.y=63;shoulders.scale.set(1,.7,.85);site.add(shoulders);
    const head=new THREE.Mesh(new THREE.SphereGeometry(1.9,14,12),copper);head.position.y=66.6;site.add(head);
    for(let i=0;i<7;i++){const spike=new THREE.Mesh(new THREE.ConeGeometry(.28,2.6,6),copper);const a=-Math.PI*.55+i*Math.PI*1.1/6;spike.position.set(Math.sin(a)*1.9,68.2,-Math.cos(a)*1.9*-1);spike.rotation.set(Math.cos(a)*.9,0,-Math.sin(a)*.9);site.add(spike);}
    const arm=new THREE.Mesh(new THREE.CylinderGeometry(.85,1,13,10),copper);arm.position.set(2.8,70,0);arm.rotation.z=-.22;site.add(arm);
    const torch=new THREE.Mesh(new THREE.CylinderGeometry(1.1,.5,2.4,10),bronze);torch.position.set(4.2,77.6,0);site.add(torch);
    const flame=new THREE.Mesh(new THREE.ConeGeometry(.9,2.6,10),torchFlame);flame.position.set(4.2,80,0);site.add(flame);site.userData.flame=flame;
    const tablet=box(2.4,3.6,.8,copper,-3.2,56,-1.4,site);tablet.rotation.z=.25;
    site.traverse(child=>{if(child.isMesh){child.castShadow=true;grappleMeshes.push(child);}});
    const light=new THREE.PointLight(0xffb44a,30,40);light.position.set(4.2,80,0);site.add(light);
    return site;
  }
  // Battery Park: lawns, a promenade, and the famous bronze bull at Bowling Green.
  function makeBatteryPark() {
    const lawn=new THREE.MeshStandardMaterial({color:0x58804c,roughness:.95});
    box(520,.12,54,lawn,0,.06,971).receiveShadow=true;box(524,.16,6,mats.sidewalk,0,.08,manhattanMaxZ-4);
    for(let x=-250;x<=250;x+=5)box(.1,1,.1,metal,x,.6,manhattanMaxZ-1.2);
    box(524,.08,.1,metal,0,1.1,manhattanMaxZ-1.2);
    for(let i=0;i<26;i++)parkTree(-240+i*19+random(i*7)*6,952+random(i*3)*36,8800+i,.12,true);
    for(let i=0;i<8;i++)bench(-200+i*55,992,Math.PI);
    const bull=new THREE.Group();bull.position.set(20,.45,925);bull.rotation.y=-.4;bull.userData.targetable=true;scene.add(bull);
    box(6,1.2,3,bridgeStone,0,.6,0,bull);
    oval(bull,bronze,0,2.5,0,1.9,1.05,.95);oval(bull,bronze,1.9,2.6,0,.7,.62,.55);oval(bull,bronze,-1.6,2.4,0,.75,.8,.85);
    for(const side of [-1,1]){const horn=new THREE.Mesh(new THREE.ConeGeometry(.12,1.2,6),bronze);horn.position.set(2.3,3.3,side*.55);horn.rotation.z=-1.1;horn.rotation.x=side*.6;bull.add(horn);}
    for(const dx of [-1.2,1.2])for(const dz of [-.45,.45]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.16,.13,1.4,6),bronze);leg.position.set(dx,1.6,dz);bull.add(leg);}
    bull.traverse(child=>{if(child.isMesh){child.castShadow=true;grappleMeshes.push(child);}});
    collider(20,925,6,3,0,1.65,true);
    plazaVisitors(20,935,10,6,6,8900);
  }
  // Coney Island: sand, a boardwalk, a hot dog joint, and a spinning Wonder Wheel.
  const wonderWheel={group:null,rim:null,cars:[]};
  function makeConeyIsland() {
    const sand=material(0xd6c08a),plank=material(0x8a6a48);
    box(brooklyn.maxX-brooklyn.minX,.1,brooklyn.maxZ-1064,sand,(brooklyn.minX+brooklyn.maxX)/2,.05,(brooklyn.maxZ+1064)/2).receiveShadow=true;
    box(brooklyn.maxX-brooklyn.minX,.4,8,plank,(brooklyn.minX+brooklyn.maxX)/2,.2,1066).receiveShadow=true;
    collider((brooklyn.minX+brooklyn.maxX)/2,1066,brooklyn.maxX-brooklyn.minX,8,-.5,.4,true);
    for(let i=0;i<14;i++){const umbrella=new THREE.Mesh(new THREE.ConeGeometry(1.6,.7,10),new THREE.MeshStandardMaterial({color:[0xe0454b,0x3d7fd6,0xf2c14a,0x3fb37f][i%4],roughness:.7}));umbrella.position.set(380+i*27,2.4,1088+random(i)*14);scene.add(umbrella);box(.08,2.2,.08,metal,umbrella.position.x,1.1,umbrella.position.z);}
    const wheel=new THREE.Group();wheel.position.set(560,27,1084);scene.add(wheel);wonderWheel.group=wheel;
    const frame=new THREE.MeshStandardMaterial({color:0xe8e2d4,roughness:.5,metalness:.4});
    for(const side of [-1,1])for(const lean of [-1,1]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.5,.7,30,8),frame);leg.position.set(560+lean*8,13,1084+side*3);leg.rotation.z=lean*.27;leg.castShadow=true;scene.add(leg);grappleMeshes.push(leg);}
    const rim=new THREE.Group();wheel.add(rim);wonderWheel.rim=rim;
    for(const side of [-1,1]){const ring=new THREE.Mesh(new THREE.TorusGeometry(22,.45,8,64),frame);ring.position.z=side*1.6;rim.add(ring);const inner=new THREE.Mesh(new THREE.TorusGeometry(13,.3,6,48),frame);inner.position.z=side*1.6;rim.add(inner);}
    for(let i=0;i<16;i++){const spoke=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,44,6),frame);spoke.rotation.z=i*Math.PI/16;rim.add(spoke);}
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(2,2,4,16),new THREE.MeshStandardMaterial({color:0xd84d4d,roughness:.5}));hub.rotation.x=Math.PI/2;rim.add(hub);
    const carColors=[0xd84d4d,0xf2c14a,0x3d7fd6,0x3fb37f];
    for(let i=0;i<16;i++) {
      const a=i*Math.PI*2/16,car=new THREE.Group();car.position.set(Math.cos(a)*22,Math.sin(a)*22,0);rim.add(car);
      const cab=new THREE.Mesh(new THREE.BoxGeometry(3,2.4,2.4),new THREE.MeshStandardMaterial({color:carColors[i%4],roughness:.5}));cab.position.y=-2;car.add(cab);
      box(.12,1.6,.12,metal,0,-.6,0,car);wonderWheel.cars.push(car);
    }
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(18,4.5),displayMaterial('WONDER WHEEL','RIDE AT YOUR OWN RISK','#d84d4d'));sign.position.set(560,4.5,1076.5);sign.rotation.y=Math.PI;scene.add(sign);
    wheel.traverse(child=>{if(child.isMesh){child.castShadow=true;grappleMeshes.push(child);}});
    hotDogStand(470,1060,8701,440,1040);hotDogStand(660,1060,8702,640,1040);
    plazaVisitors(520,1090,60,10,10,8800);
  }
