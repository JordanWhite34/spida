(() => {
  'use strict';
  if (typeof THREE === 'undefined') { document.getElementById('error').hidden = false; return; }
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.autoClear = false;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb8cad3);
  scene.fog = new THREE.Fog(0xc8c6c1, 200, 850);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { altitude: { value: 0 } },
    vertexShader: 'varying vec3 vPosition; void main() { vPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      varying vec3 vPosition;
      uniform float altitude;
      float hash(vec2 p) { return fract(sin(dot(p,vec2  (127.1,311.7)))*43758.5453); }
      float noise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+1.0),f.x),f.y);
      }
      void main() {
        vec3 dir=normalize(vPosition); float h=dir.y;
        vec3 col=mix(vec3(.88,.76,.68),vec3(.25,.46,.65),smoothstep(-.08,.78,h));
        vec3 sun=normalize(vec3(-.48,.80,.32)); float d=max(dot(dir,sun),0.0);
        col+=vec3(.32,.22,.13)*pow(d,12.0)+vec3(.65,.51,.34)*pow(d,700.0);
        vec2 p=dir.xz/max(h+.22,.12)*1.6;
        float cloud=noise(p)*.55+noise(p*2.07)*.27+noise(p*4.13)*.13;
        float mask=smoothstep(.54,.72,cloud)*smoothstep(.015,.17,h)*(1.0-smoothstep(.67,.95,h));
        col=mix(col,vec3(.91,.86,.80),mask*.34);
        col=mix(col,col*vec3(.15,.22,.42),smoothstep(250.0,750.0,altitude));
        gl_FragColor=vec4(col,1.0);
      }`
  })); scene.add(sky);
  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .3, 1300);
  camera.rotation.order='YXZ';
  scene.add(new THREE.HemisphereLight(0xdbefff, 0x817b6d, 1.7));
  const fill=new THREE.DirectionalLight(0x9dbcd5,.48);fill.position.set(80,55,-90);scene.add(fill);
  const sun = new THREE.DirectionalLight(0xffd5aa, 2.5); sun.position.set(-60, 100, 40); sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024); Object.assign(sun.shadow.camera,{left:-85,right:85,top:85,bottom:-85,near:1,far:300});
  sun.shadow.bias=-0.0003; sun.shadow.normalBias=.04; scene.add(sun); scene.add(sun.target);
  const material = color => new THREE.MeshStandardMaterial({ color, roughness: .88 });
  const mats = { road: material(0x4e5960), sidewalk: material(0xb8b5a9), line: material(0xf4e9c6), red: material(0xc93434), blue: material(0x243e74), dark: material(0x1f2633), white: material(0xf7f4e9), roof: material(0x536268) };
  const box = (w,h,d,mat,x,y,z,parent=scene) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); mesh.position.set(x,y,z); parent.add(mesh); return mesh; };
  const random = n => { const v = Math.sin(n * 127.1 + 17.7) * 43758.5453; return v - Math.floor(v); };
  const parkWaters=[{x:-4,z:-169,rx:16,rz:11},{x:-20,z:-70,rx:32,rz:39,reservoir:true},{x:-32,z:65,rx:27,rz:21},{x:-8,z:34,rx:8,rz:5},{x:4,z:172,rx:13,rz:9}];
  function pondVariation(body,angle) {return body.reservoir?1:1+.10*Math.sin(3*angle+.4)+.045*Math.sin(5*angle-.6);}
  // Manhattan runs north (-z) to south (+z) between the Hudson and the East
  // River; Brooklyn sits across the river at the far end of the Brooklyn Bridge.
  const bridgeZ=760,manhattanMinZ=-700,manhattanMaxZ=1000,brooklyn={minX:358,maxX:766,minZ:436,maxZ:1110},riverWater={surface:-.29,floor:-1.6};
  function waterAt(x,z) {
    // The bridge deck and islet remain walkable even though they cross the lake.
    if(x>=-63 && x<=-1 && Math.abs(z-65)<1.5)return null;
    if(((x+40)/4.3)**2+((z-70)/2.8)**2<1)return null;
    for(const body of parkWaters) {
      const dx=x-body.x,dz=z-body.z;
      if(Math.abs(dx)>body.rx*1.15 || Math.abs(dz)>body.rz*1.15)continue;
      const nx=dx/body.rx,nz=dz/body.rz,angle=Math.atan2(nz,nx);
      if(Math.hypot(nx,nz)<pondVariation(body,angle))return {surface:.12,floor:-.85};
    }
    if(x>230 && Math.abs(z)<80 && !(z>18.5&&z<25.5) && !(z> -58&&z< -50))return {surface:.06,floor:-.95};
    // The Hudson, East River and the harbor are deep enough to swim in.
    if(x>262 && x<brooklyn.minX)return riverWater;
    if(x>=brooklyn.minX && (z<brooklyn.minZ || z>brooklyn.maxZ || x>brooklyn.maxX))return riverWater;
    if(x<=262 && (z>manhattanMaxZ || z<manhattanMinZ || x< -262))return riverWater;
    return null;
  }
  function addWaterHoles(shape,includeHarbor=false) {
    for(const body of parkWaters) {
      const hole=new THREE.Path();
      for(let i=0;i<=96;i++) {
        const angle=-i*Math.PI*2/96,v=pondVariation(body,angle),x=body.x+Math.cos(angle)*body.rx*v,y=-(body.z+Math.sin(angle)*body.rz*v);
        if(i===0)hole.moveTo(x,y);else hole.lineTo(x,y);
      }
      shape.holes.push(hole);
    }
    if(includeHarbor){const hole=new THREE.Path();hole.moveTo(230,80);hole.lineTo(261.99,80);hole.lineTo(261.99,-80);hole.lineTo(230,-80);hole.closePath();shape.holes.push(hole);}
  }
  // A long island surrounded by water keeps the playable street at its original height.
  const streetShape=new THREE.Shape();streetShape.moveTo(-262,-manhattanMaxZ);streetShape.lineTo(262,-manhattanMaxZ);streetShape.lineTo(262,-manhattanMinZ);streetShape.lineTo(-262,-manhattanMinZ);streetShape.closePath();addWaterHoles(streetShape,true);
  const street=new THREE.Mesh(new THREE.ShapeGeometry(streetShape),mats.road);street.rotation.x=-Math.PI/2;street.receiveShadow=true;scene.add(street);
  // A tiling ripple normal map, scrolled every frame, makes the rivers glint like water.
  const waterNormals=(()=>{
    const size=256,image=document.createElement('canvas');image.width=image.height=size;const c=image.getContext('2d'),data=c.createImageData(size,size),heights=new Float32Array(size*size);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){const u=x/size*Math.PI*2,v=y/size*Math.PI*2;heights[y*size+x]=Math.sin(u*3+Math.sin(v*2)*1.5)+Math.sin(v*5+u*2)*.6+Math.sin((u+v)*7)*.25+Math.sin(u*11-v*4)*.15;}
    for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
      const dx=heights[y*size+(x+1)%size]-heights[y*size+(x+size-1)%size],dy=heights[((y+1)%size)*size+x]-heights[((y+size-1)%size)*size+x];
      const n=new THREE.Vector3(-dx*2,-dy*2,1).normalize(),i=(y*size+x)*4;
      data.data[i]=(n.x*.5+.5)*255;data.data[i+1]=(n.y*.5+.5)*255;data.data[i+2]=(n.z*.5+.5)*255;data.data[i+3]=255;
    }
    c.putImageData(data,0,0);const texture=new THREE.CanvasTexture(image);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(220,220);return texture;
  })();
  const harborWater=new THREE.MeshStandardMaterial({color:0x2f5d72,roughness:.18,metalness:.35,normalMap:waterNormals,normalScale:new THREE.Vector2(.55,.55),transparent:true,opacity:.92,depthWrite:false});
  const water=box(6000,.1,6000,harborWater,0,-.35,0);water.receiveShadow=true;
  const wadeRipple=new THREE.Mesh(new THREE.RingGeometry(.7,.78,32),new THREE.MeshBasicMaterial({color:0xe2f2e7,transparent:true,opacity:.45,side:THREE.DoubleSide,depthWrite:false}));
  wadeRipple.rotation.x=-Math.PI/2;wadeRipple.visible=false;wadeRipple.userData.projectile=true;scene.add(wadeRipple);
  // Brooklyn's streets, then stone seawalls and the far shores of the other boroughs.
  const brooklynStreets=box(brooklyn.maxX-brooklyn.minX,.1,brooklyn.maxZ-brooklyn.minZ,mats.road,(brooklyn.minX+brooklyn.maxX)/2,-.05,(brooklyn.minZ+brooklyn.maxZ)/2);brooklynStreets.receiveShadow=true;
  const seawall=material(0x7d786e),farShore=material(0x5d6461);
  for(const [x0,x1,z0,z1] of [[-266,266,manhattanMinZ-4,manhattanMaxZ+4],[brooklyn.minX-4,brooklyn.maxX+4,brooklyn.minZ-4,brooklyn.maxZ+4]]) {
    // A ring of stone edges each shore, leaving park ponds open to the water below.
    box(x1-x0,1.2,5,seawall,(x0+x1)/2,-.62,z0+2.5);box(x1-x0,1.2,5,seawall,(x0+x1)/2,-.62,z1-2.5);
    box(5,1.2,z1-z0,seawall,x0+2.5,-.62,(z0+z1)/2);box(5,1.2,z1-z0,seawall,x1-2.5,-.62,(z0+z1)/2);
  }
  for(const [x0,x1,z0,z1] of [[-1600,-430,-1600,1700],[430,1600,-1600,380],[brooklyn.maxX+4,1600,brooklyn.minZ-4,brooklyn.maxZ+4],[-420,420,-1600,-760]])box(x1-x0,.6,z1-z0,farShore,(x0+x1)/2,-.2,(z0+z1)/2).receiveShadow=true;
  const buildings = [], upperBuildingColliders = [], grappleMeshes = [], destructibleBuildings=[];
  const worldMinX=-258,worldMaxX=762,worldMinZ=-698,worldMaxZ=1106;
  // Repeating facade tiles retain a consistent window size across short and tall buildings.
  function facadeMaterial(kind, tint) {
    const image=document.createElement('canvas'); image.width=256; image.height=512;
    const c=image.getContext('2d'),glassStyle=kind===2||kind===4;
    c.fillStyle=kind===4?'#7696a6':kind===2?'#899a9d':kind===3?'#975d4e':kind===1?'#b1a092':'#d0c4b3'; c.fillRect(0,0,256,512);
    // Subtle surface grain keeps the masonry and glass from looking perfectly flat.
    for(let i=0;i<2600;i++) {
      const px=random(i*19+kind*71)*256,py=random(i*31+kind*97)*512;
      c.fillStyle=i%2?'rgba(255,255,255,.035)':'rgba(28,33,34,.035)';c.fillRect(px,py,1+(i%3),1);
    }
    if(!glassStyle) {
      c.strokeStyle='rgba(70,54,48,.16)'; c.lineWidth=1;
      for(let y=0;y<512;y+=8) { c.beginPath(); c.moveTo(0,y); c.lineTo(256,y); c.stroke();
        for(let x=(y%16?0:8);x<256;x+=16) {c.beginPath();c.moveTo(x,y);c.lineTo(x,y+8);c.stroke();} }
    }
    const cols=glassStyle?8:6, rows=16, dx=256/cols, dy=512/rows;
    for(let row=0;row<rows;row++) for(let col=0;col<cols;col++) {
      const x=col*dx+(glassStyle?2:5),y=row*dy+(glassStyle?2:4),w=dx-(glassStyle?4:10),h=dy-(glassStyle?4:8);
      const variation=random(row*37+col*13+kind*77);
      c.fillStyle=glassStyle?'#526a70':kind===3?'#60473f':'#746e65'; c.fillRect(x-2,y-2,w+4,h+5);
      const glass=c.createLinearGradient(x,y,x+w,y+h);
      glass.addColorStop(0,variation>.5?'#8da7a8':'#78939b');
      glass.addColorStop(.52,variation>.45?'#526e7b':'#405e6c');glass.addColorStop(1,'#263f4d');
      c.fillStyle=variation>.94?'#b49c7c':glass; c.fillRect(x,y,w,h);
      // A faint sky reflection and varied blinds keep the glass from reading as a flat grid.
      c.fillStyle='rgba(224,235,226,.14)';c.beginPath();c.moveTo(x,y+h*.10);c.lineTo(x+w,y);c.lineTo(x+w,y+h*.24);c.lineTo(x,y+h*.38);c.fill();
      if(variation<.22){c.fillStyle='rgba(216,204,182,.25)';c.fillRect(x+1,y+1,w-2,h*(.22+variation));}
      c.fillStyle='rgba(211,224,220,.28)'; c.fillRect(x+w*.49,y,1,h);
      if(!glassStyle) {c.fillRect(x,y+h*.53,w,1);c.fillStyle='rgba(245,235,217,.42)';c.fillRect(x-2,y+h+1,w+4,2);}
    }
    const texture=new THREE.CanvasTexture(image); texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    return new THREE.MeshStandardMaterial({color:tint,map:texture,roughness:glassStyle?.35:.86,metalness:glassStyle?.22:.02});
  }
  function facadeBox(w,h,d,mat,x,y,z) {
    const mesh=box(w,h,d,mat,x,y,z), geometry=mesh.geometry;
    const p=geometry.attributes.position, n=geometry.attributes.normal, uv=geometry.attributes.uv;
    for(let i=0;i<p.count;i++) {
      // One tile represents approximately 24 by 48 world units.
      if(Math.abs(n.getX(i))>.5)uv.setXY(i,p.getZ(i)/24,p.getY(i)/48);
      else if(Math.abs(n.getZ(i))>.5)uv.setXY(i,p.getX(i)/24,p.getY(i)/48);
      else uv.setXY(i,p.getX(i)/24,p.getZ(i)/48);
    }
    uv.needsUpdate=true;return mesh;
  }
  const buildingMats=[facadeMaterial(0,0xded8cb),facadeMaterial(1,0xcab9aa),facadeMaterial(2,0xc8d4d2),facadeMaterial(0,0xbeb6a9),facadeMaterial(3,0xffffff),facadeMaterial(4,0xe1eef2)];
  // Distant neighborhoods extend along the island without filling the rivers.
  const distantBuildings=[];
  function makeDistantCity() {
    const group=new THREE.Group(), geometry=new THREE.BoxGeometry(1,1,1), limit=20*20;
    const shapedGeometries=[new THREE.CylinderGeometry(.5,.5,1,20),new THREE.CylinderGeometry(.5,.5,1,4),new THREE.CylinderGeometry(.5,.5,1,8)];
    // Each neighborhood has its own bounds so Three.js can cull it off screen.
    for(let sectorX=-30;sectorX<30;sectorX+=20)for(let sectorZ=-30;sectorZ<30;sectorZ+=20) {
      const towers=buildingMats.map(mat=>new THREE.InstancedMesh(geometry,mat,limit));
      const roofs=new THREE.InstancedMesh(geometry,mats.roof,limit);
      const shapedTowers=shapedGeometries.map((geo,i)=>new THREE.InstancedMesh(geo,buildingMats[[5,2,0][i]],limit));
      const shapedRoofs=shapedGeometries.map(geo=>new THREE.InstancedMesh(geo,mats.roof,limit));
      const sidewalks=new THREE.InstancedMesh(geometry,mats.sidewalk,limit);
      const counts=buildingMats.map(()=>0),shapedCounts=[0,0,0], transform=new THREE.Object3D();let count=0,roofCount=0;
      for(let gx=sectorX;gx<sectorX+20;gx++) for(let gz=sectorZ;gz<sectorZ+20;gz++) {
        // Only the far shores get skyline: New Jersey, Queens, the Bronx and outer Brooklyn.
        const x=gx*40+20,z=gz*40+20,seed=(gx+40)*31+(gz+40)*73;
        const zone=x< -460?'jersey':x>460&&z<350?'queens':x>800&&z>=440&&z<1080?'brooklyn':z< -800&&Math.abs(x)<390?'bronx':null;
        if(!zone || random(seed+5)>(zone==='jersey'?.75:.6))continue;
        const kind=Math.floor(random(seed+90)*buildingMats.length);
        const skyline=(zone==='jersey'&&x>-760&&z>250&&z<850)||(zone==='queens'&&x<660&&z>-150);
        const height=(zone==='jersey'?16+random(seed)*40:10+random(seed)*26)+(skyline&&random(seed+8)>.55?45+random(seed+9)*50:0);
        const width=19+random(seed+1)*7,depth=20+random(seed+2)*6;
        const shapeChance=random(seed+131),shape=shapeChance>.67?Math.min(2,Math.floor((shapeChance-.67)/.33*3)):-1;
        transform.position.set(x,height/2+.45,z);transform.scale.set(width,height,depth);transform.updateMatrix();
        const tower=shape<0?towers[kind]:shapedTowers[shape],towerIndex=shape<0?counts[kind]++:shapedCounts[shape];
        tower.setMatrixAt(towerIndex,transform.matrix);const towerMatrix=transform.matrix.clone();
        transform.position.set(x,height+.6,z);transform.scale.set(width+1,.7,depth+1);transform.updateMatrix();
        const roof=shape<0?roofs:shapedRoofs[shape],roofIndex=shape<0?roofCount++:shapedCounts[shape]++;
        roof.setMatrixAt(roofIndex,transform.matrix);
        distantBuildings.push({x,z,seed,tower,towerIndex,towerMatrix,roof,roofIndex,roofMatrix:transform.matrix.clone()});
        transform.position.set(x,.2,z);transform.scale.set(29,.45,29);transform.updateMatrix();sidewalks.setMatrixAt(count++,transform.matrix);
      }
      towers.forEach((tower,i)=>{tower.count=counts[i];if(tower.count){tower.computeBoundingSphere();group.add(tower);}});
      shapedTowers.forEach((tower,i)=>{tower.count=shapedRoofs[i].count=shapedCounts[i];if(tower.count){tower.computeBoundingSphere();shapedRoofs[i].computeBoundingSphere();group.add(tower,shapedRoofs[i]);}});
      roofs.count=roofCount;sidewalks.count=count;roofs.computeBoundingSphere();sidewalks.computeBoundingSphere();group.add(roofs,sidewalks);
    }
    scene.add(group);
  }
  makeDistantCity();
  const stone=material(0xaca79d), darkGlass=new THREE.MeshStandardMaterial({color:0x344e58,roughness:.3,metalness:.25}), awning=material(0x6b3435), metal=material(0x68747a);
  const cranePaint=new THREE.MeshStandardMaterial({color:0xd6aa39,roughness:.55,metalness:.25});
  const cableMat=material(0x404449);
  const fallenCableMaterial=new THREE.LineBasicMaterial({color:0x454b4a});
  function beamBetween(parent,a,b,radius,mat) {
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,delta.length(),8),mat);
    beam.position.copy(start).add(end).multiplyScalar(.5);beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());parent.add(beam);return beam;
  }
  function makeCrane(x,z,roof,angle) {
    const crane=new THREE.Group();crane.position.set(x,roof,z);crane.rotation.y=angle;crane.userData.targetable=true;crane.userData.grappleKind='crane';scene.add(crane);
    for(const dx of [-.8,.8]) for(const dz of [-.8,.8]) box(.18,30,.18,cranePaint,dx,15,dz,crane);
    for(let y=1;y<30;y+=3) {
      for(const dz of [-.8,.8]) {box(1.7,.12,.12,cranePaint,0,y,dz,crane);beamBetween(crane,[-.8,y,dz],[.8,y+3,dz],.055,cranePaint);}
      for(const dx of [-.8,.8]) box(.12,.12,1.7,cranePaint,dx,y,0,crane);
    }
    box(34,.34,1.6,cranePaint,7,30,0,crane);box(.8,5,.8,cranePaint,0,32,0,crane);
    beamBetween(crane,[0,34,0],[24,30,0],.05,cableMat);beamBetween(crane,[0,34,0],[-10,30,0],.05,cableMat);
    for(let x=-8;x<23;x+=3) beamBetween(crane,[x,30,-.7],[x+3,30,.7],.045,cranePaint);
    box(2,1.5,2,stone,-8,29,0,crane);beamBetween(crane,[18,30,0],[18,19,0],.045,cableMat);
    const hook=new THREE.Mesh(new THREE.TorusGeometry(.35,.08,8,16,Math.PI*1.5),cableMat);hook.position.set(18,18.7,0);crane.add(hook);
    crane.traverse(child=>{if(child.isMesh)grappleMeshes.push(child);});
  }
  // The park spans a longer north-south rectangle; north is negative Z.
  const parkBounds={minX:-74.5,maxX:34.5,minZ:-194.5,maxZ:194.5};
  function inPark(x,z){return x>parkBounds.minX&&x<parkBounds.maxX&&z>parkBounds.minZ&&z<parkBounds.maxZ;}
  // Reserve a block for each plaza and a few eastern blocks for the waterfront.
  function interestBlock(gx,gz){return (gx===1&&gz===5)||(gx===0&&gz===13)||(gx===5&&gz>=-5&&gz<=4);} 
  // Broadway cuts diagonally through the otherwise regular Manhattan grid.
  const curvedRoads = [
    [[-240,-120],[-205,-130],[-165,-151],[-125,-178],[-80,-200]],
    [[80,-200],[98,-181],[119,-156],[143,-119],[160,-80]]
  ].map(points=>{
    const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z)));
    return {curve,samples:curve.getSpacedPoints(160)};
  });
  function nearCurvedRoad(x,z,distance) {
    return curvedRoads.some(road=>road.samples.some(p=>Math.hypot(p.x-x,p.z-z)<distance));
  }
  function roadCrossesBlock(x,z) {
    return curvedRoads.some(road=>road.samples.some(p=>Math.abs(p.x-x)<21 && Math.abs(p.z-z)<21));
  }
  function curvedBlockPavement(x,z) {
    const segments=[];
    for(const road of curvedRoads)for(let i=1;i<road.samples.length;i++) {
      const a=road.samples[i-1],b=road.samples[i];
      if(Math.abs(a.x-x)<35&&Math.abs(a.z-z)<35)segments.push([a,b]);
    }
    function clearance(px,pz) {
      let nearest=Infinity;
      for(const [a,b] of segments) {
        const dx=b.x-a.x,dz=b.z-a.z,lengthSq=dx*dx+dz*dz;
        const t=lengthSq?THREE.MathUtils.clamp(((px-a.x)*dx+(pz-a.z)*dz)/lengthSq,0,1):0;
        nearest=Math.min(nearest,Math.hypot(px-a.x-dx*t,pz-a.z-dz*t));
      }
      return nearest-5.5;
    }
    const vertices=[],indices=[];
    function addClippedTriangle(points) {
      const clipped=[];
      for(let i=0;i<3;i++) {
        const a=points[i],b=points[(i+1)%3],insideA=a.d>=0,insideB=b.d>=0;
        if(insideA)clipped.push(a);
        if(insideA!==insideB) {
          const t=a.d/(a.d-b.d);clipped.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
        }
      }
      if(clipped.length<3)return;
      const offset=vertices.length/3;for(const p of clipped)vertices.push(p.x,.425,p.z);
      for(let i=1;i<clipped.length-1;i++)indices.push(offset,offset+i,offset+i+1);
    }
    for(let row=0;row<29;row++)for(let col=0;col<29;col++) {
      const left=x-14.5+col,near=z-14.5+row;
      const points=[[left,near],[left,near+1],[left+1,near+1],[left+1,near]].map(([px,pz])=>({x:px,z:pz,d:clearance(px,pz)}));
      addClippedTriangle([points[0],points[1],points[2]]);addClippedTriangle([points[0],points[2],points[3]]);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const pavement=new THREE.Mesh(geometry,mats.sidewalk);pavement.receiveShadow=true;scene.add(pavement);
  }
  function nearGridStreet(x,z,distance) {
    return Math.abs(x-Math.round(x/40)*40)<distance || Math.abs(z-Math.round(z/40)*40)<distance;
  }
  function buildCurvedRoad(road) {
    const group=new THREE.Group();group.userData.roadKind='curved';scene.add(group);
    function ribbon(inner,outer,y,mat) {
      const vertices=[],indices=[];
      road.samples.forEach((point,i)=>{
        const prev=road.samples[Math.max(0,i-1)],next=road.samples[Math.min(road.samples.length-1,i+1)];
        const dx=next.x-prev.x,dz=next.z-prev.z,length=Math.hypot(dx,dz)||1,nx=-dz/length,nz=dx/length;
        vertices.push(point.x+nx*inner,y,point.z+nz*inner,point.x+nx*outer,y,point.z+nz*outer);
        // Leave the sidewalks open where a cross street joins the avenue.
        const crossStreet=nearGridStreet(point.x+nx*inner,point.z+nz*inner,5.9) || nearGridStreet(point.x+nx*outer,point.z+nz*outer,5.9);
        if(i && (mat===mats.road || !crossStreet)){const j=i*2;indices.push(j-2,j-1,j,j-1,j+1,j);}
      });
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,mat);mesh.receiveShadow=true;group.add(mesh);
    }
    ribbon(-5.4,5.4,.035,mats.road);
    ribbon(-7.3,-5.4,.075,mats.sidewalk);ribbon(5.4,7.3,.075,mats.sidewalk);
    const dashGeometry=new THREE.BoxGeometry(.14,.025,2.4);
    const count=Math.floor(road.curve.getLength()/7);
    for(let i=1;i<count;i++) {
      const t=i/count,point=road.curve.getPointAt(t),tangent=road.curve.getTangentAt(t);
      if(nearGridStreet(point.x,point.z,8))continue;
      const dash=new THREE.Mesh(dashGeometry,mats.line);dash.position.set(point.x,.055,point.z);dash.rotation.y=Math.atan2(tangent.x,tangent.z);group.add(dash);
    }
  }
  // Pair neighboring 40-unit lots into long east-west Manhattan blocks.
  // Park edges remain avenues, and special sites and Broadway keep their clearance.
  function joinedBlock(x,z) {
    const gx=Math.round(x/40),gz=Math.floor(z/40);
    if(Math.abs(gx)%2!==1 || x===40 || x===-80)return false;
    const left=gx-1,right=gx;
    if(left< -6 || right>=6 || gz< -6 || gz>=21)return false;
    if((left>=-2&&left<=0&&gz>=-5&&gz<=4) || (right>=-2&&right<=0&&gz>=-5&&gz<=4))return false;
    if(interestBlock(left,gz)||interestBlock(right,gz))return false;
    return !roadCrossesBlock(x-20,z) && !roadCrossesBlock(x+20,z);
  }
  // The rounded and faceted towers use their actual footprints for movement collisions.
  function insideBuilding(x,z,b,margin=0) {
    if(b.destroyed || b.structure?.destroyed)return false;
    const dx=Math.abs(x-b.x),dz=Math.abs(z-b.z),rx=b.w/2+margin,rz=b.d/2+margin;
    if(dx>=rx || dz>=rz)return false;
    if(!b.shape)return dx<rx&&dz<rz;
    const nx=(x-b.x)/rx,nz=(z-b.z)/rz;
    if(b.shape==='round')return nx*nx+nz*nz<1;
    if(b.shape==='triangle')return nz>-1 && Math.abs(nx)<(nz+1)/2;
    const sides=b.shape==='diamond'?4:8,limit=Math.cos(Math.PI/sides);
    for(let i=0;i<sides;i++) {
      const angle=(i+.5)*Math.PI*2/sides;
      if(nx*Math.sin(angle)+nz*Math.cos(angle)>=limit)return false;
    }
    return true;
  }
  // The wedge footprint points north (-z) and fills its bounding box like the other shapes.
  const triangleTowerGeometry=(()=>{const geometry=new THREE.CylinderGeometry(1,1,1,3);geometry.rotateY(Math.PI);geometry.scale(1/Math.sin(Math.PI/3),1,4/3);geometry.translate(0,0,1/3);return geometry;})();
  const roundTowerGeometry=new THREE.CylinderGeometry(1,1,1,32),diamondTowerGeometry=new THREE.CylinderGeometry(1,1,1,4),octagonalTowerGeometry=new THREE.CylinderGeometry(1,1,1,8);
  function shapedBuilding(x,z,w,d,bottom,height,facade,shape) {
    const geometry=shape==='triangle'?triangleTowerGeometry:shape==='round'?roundTowerGeometry:shape==='diamond'?diamondTowerGeometry:octagonalTowerGeometry;
    const mesh=new THREE.Mesh(geometry,facade);mesh.position.set(x,bottom+height/2,z);mesh.scale.set(w/2,height,d/2);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;
  }
  function setback(x,z,w,d,bottom,height,facade) {
    const tier=facadeBox(w,height,d,facade,x,bottom+height/2,z);tier.castShadow=true;tier.receiveShadow=true;
    const cap=box(w+.35,.35,d+.35,stone,x,bottom+height+.175,z);cap.castShadow=true;
    grappleMeshes.push(tier,cap);
    upperBuildingColliders.push({x,z,w,d,bottom,height:bottom+height+.35});
    return bottom+height+.35;
  }
  function registerDestructible(building,parts,upperStart) {
    building.parts=parts;building.instanceParts=[];building.hits=0;building.destroyed=false;
    building.upper=upperBuildingColliders.slice(upperStart);
    for(const collider of building.upper)collider.structure=building;
    for(const part of parts)part.userData.structure=building;
    destructibleBuildings.push(building);
  }
  // Landmarks use the same collision and grapple lists as the rest of the city.
  const landmarkSites=[{kind:'chrysler',x:140,z:260},{kind:'flatiron',x:20,z:460},{kind:'empire-state',x:60,z:300},{kind:'twin-north',x:-180,z:700},{kind:'twin-south',x:-140,z:700}];
  const landmarkStone=material(0xc6b9a5),landmarkMetal=material(0x9aa6a9);
  const chrome=new THREE.MeshStandardMaterial({color:0xd5dadd,roughness:.18,metalness:.92}),sunburst=new THREE.MeshBasicMaterial({color:0xfff1c4});
  function makeChrysler(x,z) {
    box(29,.45,29,mats.sidewalk,x,.2,z);
    const height=78,tower=facadeBox(22,height,22,buildingMats[3],x,height/2+.45,z);tower.castShadow=true;tower.receiveShadow=true;grappleMeshes.push(tower);
    let top=height+.45;
    for(const [w,h] of [[18,14],[14,10]])top=setback(x,z,w,w,top,h,buildingMats[3]);
    for(const dx of [-1,1])for(const dz of [-1,1])box(1.8,.6,.6,chrome,x+dx*9.4,height-1,z+dz*9.4);
    // Stacked chrome arches pierced by triangular windows form the crown.
    for(let i=0;i<6;i++) {
      const radius=6.5-i,tier=new THREE.Mesh(new THREE.CylinderGeometry(radius*.9,radius,3.6,4),chrome);
      tier.rotation.y=Math.PI/4;tier.position.set(x,top+1.8+i*3.6,z);tier.castShadow=true;scene.add(tier);grappleMeshes.push(tier);
      for(let face=0;face<4;face++){const a=face*Math.PI/2,window=new THREE.Mesh(new THREE.ConeGeometry(.5,1.5,3),sunburst);window.position.set(x+Math.sin(a)*radius*.66,top+1.8+i*3.6,z+Math.cos(a)*radius*.66);scene.add(window);}
    }
    upperBuildingColliders.push({x,z,w:12,d:12,bottom:top,height:top+21.6});
    const spire=new THREE.Mesh(new THREE.ConeGeometry(.9,24,8),chrome);spire.position.set(x,top+21.6+12,z);spire.castShadow=true;scene.add(spire);grappleMeshes.push(spire);
    buildings.push({x,z,w:22,d:22,height:height+.45,landmark:'chrysler'});
  }
  function makeFlatiron(x,z) {
    box(29,.45,29,mats.sidewalk,x,.2,z);
    const height=52,tower=shapedBuilding(x,z,22,28,.45,height,buildingMats[1],'triangle'),roof=shapedBuilding(x,z,22.8,28.8,height+.45,.8,stone,'triangle');
    for(const y of [5.5,height-5])shapedBuilding(x,z,22.6,28.6,y,.5,stone,'triangle');
    grappleMeshes.push(tower,roof);
    buildings.push({x,z,w:22,d:28,height:height+1.25,shape:'triangle',landmark:'flatiron'});
  }
  function makeLandmark(site) {
    if(site.kind==='chrysler')return makeChrysler(site.x,site.z);
    if(site.kind==='flatiron')return makeFlatiron(site.x,site.z);
    const {x,z,kind}=site,empire=kind==='empire-state';
    box(29,.45,29,mats.sidewalk,x,.2,z);
    const width=empire?25:22,height=empire?100:kind==='twin-north'?174:171;
    const facade=empire?buildingMats[0]:buildingMats[5];
    const tower=facadeBox(width,height,width,facade,x,height/2+.45,z);
    tower.castShadow=true;tower.receiveShadow=true;tower.userData.landmark=kind;
    grappleMeshes.push(tower);buildings.push({x,z,w:width,d:width,height:height+.45,landmark:kind});
    const cornice=box(width+.35,.42,width+.35,empire?landmarkStone:landmarkMetal,x,height+.66,z);grappleMeshes.push(cornice);
    // Deep vertical piers distinguish the limestone tower and the silver WTC facades.
    const count=empire?8:15;
    for(let i=0;i<=count;i++) {
      const offset=-width/2+i*width/count;
      for(const side of [-1,1]) {
        box(empire?.22:.12,height-2,.12,empire?landmarkStone:landmarkMetal,x+offset,height/2+1,z+side*(width/2+.05));
        box(.12,height-2,empire?.22:.12,empire?landmarkStone:landmarkMetal,x+side*(width/2+.05),height/2+1,z+offset);
      }
    }
    for(const side of [-1,1]) {
      box(width*.62,4,.14,darkGlass,x,2.5,z+side*(width/2+.08));
      box(width*.62,.28,.3,empire?landmarkStone:landmarkMetal,x,4.6,z+side*(width/2+.16));
    }
    if(empire) {
      let top=height+.87;
      for(const [w,h] of [[21,25],[17,18],[13,12],[9,10],[5.5,9]])top=setback(x,z,w,w,top,h,facade);
      const crown=box(4,.8,4,landmarkMetal,x,top+.4,z);grappleMeshes.push(crown);
      const mast=new THREE.Mesh(new THREE.CylinderGeometry(.08,.45,18,10),landmarkMetal);
      mast.position.set(x,top+9.8,z);mast.castShadow=true;scene.add(mast);grappleMeshes.push(mast);
    } else if(kind==='twin-north') {
      const mast=new THREE.Mesh(new THREE.CylinderGeometry(.08,.32,20,10),landmarkMetal);
      mast.position.set(x,height+10.9,z);scene.add(mast);grappleMeshes.push(mast);
    }
  }
  // Neighborhood destinations occupy ordinary blocks and share building physics.
  const communitySites=[
    {kind:'school',name:'PUBLIC SCHOOL',x:-180,z:-20,height:19},
    {kind:'hospital',name:'CITY HOSPITAL',x:140,z:20,height:34},
    {kind:'bank',name:'CITY BANK',x:-140,z:140,height:18},
    {kind:'grocery',name:'GROCERY',x:140,z:140,height:13},
    {kind:'cafe',name:'CORNER CAFE',x:60,z:-20,height:12},
    {kind:'cafe',name:'PARKSIDE CAFE',x:-180,z:180,height:12}
  ];
  function communitySign(text,color) {
    const image=document.createElement('canvas');image.width=512;image.height=96;
    const ctx=image.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,512,96);
    ctx.fillStyle='#fff7e7';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 48px sans-serif';ctx.fillText(text,256,49,480);
    const texture=new THREE.CanvasTexture(image);texture.colorSpace=THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({map:texture,roughness:.8});
  }
  function makeCommunityBuilding(site) {
    const {x,z,kind,name,height}=site,width=24,depth=22,front=z-depth/2;
    box(29,.45,29,mats.sidewalk,x,.2,z).receiveShadow=true;
    const facade=buildingMats[kind==='hospital'?0:kind==='school'?4:kind==='bank'?1:kind==='grocery'?3:0];
    const building=facadeBox(width,height,depth,facade,x,height/2+.45,z);building.castShadow=true;building.receiveShadow=true;building.userData.communityKind=kind;
    const roof=box(width+.6,.55,depth+.6,stone,x,height+.72,z);roof.castShadow=true;
    grappleMeshes.push(building,roof);buildings.push({x,z,w:width,d:depth,height:height+1,communityKind:kind,communityName:name});
    box(width*.83,3.5,.16,darkGlass,x,2.55,front-.1);
    box(2.5,3,.2,metal,x,2,front-.25);box(2.1,2.65,.22,darkGlass,x,1.85,front-.38);
    for(const side of [-1,1])box(.12,2.8,.12,stone,x+side*1.1,1.85,front-.5);
    const color=kind==='hospital'?'#9a3339':kind==='school'?'#66513f':kind==='bank'?'#303c4c':kind==='grocery'?'#42684b':'#7c4238';
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(kind==='hospital'?13:11,1.5),communitySign(name,color));sign.position.set(x,5.45,front-.22);sign.rotation.y=Math.PI;scene.add(sign);
    if(kind==='hospital') {
      const red=material(0xb83736),white=material(0xf6eee4);
      box(3.2,3.2,.15,white,x,height-4,front-.12);
      box(.65,2.5,.12,red,x,height-4,front-.25);box(2.5,.65,.12,red,x,height-4,front-.25);
      box(6,.32,2.4,white,x,4,front-1.1);box(4.8,.3,.15,red,x,3.95,front-2.35);
    } else if(kind==='school') {
      for(const side of [-1,1])box(1.1,height-2,.45,stone,x+side*10.5,height/2+.6,front-.2);
      box(8,.45,2,stone,x,4.3,front-1);box(1.2,2,.12,mats.white,x,height-3,front-.2);
    } else if(kind==='bank') {
      for(const dx of [-8,-4,4,8]) {const column=new THREE.Mesh(new THREE.CylinderGeometry(.35,.4,5,12),stone);column.position.set(x+dx,3,front-.35);column.castShadow=true;scene.add(column);}
      box(20,.45,.8,stone,x,5.7,front-.25);
    } else {
      const canopy=kind==='grocery'?material(0x547a57):material(0x9b5346);
      box(16,.25,2.2,canopy,x,4.2,front-1.05);
      for(let i=-3;i<=3;i++)box(1,.27,.12,mats.white,x+i*2,4.18,front-2.15);
      if(kind==='cafe') {
        for(const side of [-1,1]) {
          const tx=x+side*7;box(1.2,.12,1.2,stone,tx,1.05,front-2.45);
          box(.12,.95,.12,metal,tx,.55,front-2.45);
          for(const offset of [-.75,.75])box(.45,.12,.45,metal,tx+offset,.65,front-2.45);
        }
      }
    }
  }
  const billboardTexture=new THREE.TextureLoader().load(BILLBOARD_IMAGE);
  billboardTexture.colorSpace=THREE.SRGBColorSpace;
  billboardTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const billboardMat=new THREE.MeshBasicMaterial({map:billboardTexture});
  function districtAt(x,z) {
    if(x>300)return z<600&&x<600?'downtown-brooklyn':z<840&&x<540?'dumbo':'brooklyn';
    return z< -240?'harlem':z<200?'uptown':z<460?'midtown':z<660?'village':'fidi';
  }
  const tankGeometry=new THREE.CylinderGeometry(1.5,1.5,2.8,12),tankRoofGeometry=new THREE.ConeGeometry(1.65,.9,12),tankWood=material(0x7a5f45);
  // The wooden rooftop water tank is the most New York thing on any skyline.
  function waterTower(x,y,z) {
    for(const dx of [-.9,.9])for(const dz of [-.9,.9])box(.14,2.2,.14,metal,x+dx,y+1.1,z+dz);
    const tank=new THREE.Mesh(tankGeometry,tankWood);tank.position.set(x,y+3.6,z);tank.castShadow=true;scene.add(tank);
    const cap=new THREE.Mesh(tankRoofGeometry,mats.roof);cap.position.set(x,y+5.45,z);scene.add(cap);grappleMeshes.push(tank,cap);
  }
  // Two rows of walk-ups per block, with stoops facing each street.
  function rowHouseBlock(x,z,seed,district) {
    const pavement=box(29,.45,29,mats.sidewalk,x,.2,z);pavement.receiveShadow=true;
    for(const side of [-1,1]) {
      const bz=z+side*7.5,first=scene.children.length,upperStart=upperBuildingColliders.length;
      const height=Math.floor((district==='harlem'?11:9)+random(seed+side*17)*(district==='harlem'?11:8));
      const facade=buildingMats[random(seed+side*5)>.45?4:1];
      const tower=facadeBox(27,height,11,facade,x,height/2+.45,bz);tower.castShadow=true;tower.receiveShadow=true;
      const roof=box(27.6,.5,11.6,mats.roof,x,height+.7,bz);roof.castShadow=true;
      box(27.9,.55,11.9,stone,x,height+.2,bz);
      const front=bz+side*5.5;
      for(const n of [-1.5,-.5,.5,1.5]) {
        const doorX=x+n*6.4;box(1.2,2.3,.12,awning,doorX,1.6,front+side*.07);
        for(let step=0;step<3;step++)box(1.8,.18,.4,stone,doorX,.48+step*.18,front+side*(1.05-step*.32));
      }
      if(random(seed+side*41)>.5)waterTower(x+side*6-3,height+.95,bz);
      const building={x,z:bz,w:27,d:11,height:height+.95,rowHouse:true};buildings.push(building);grappleMeshes.push(tower,roof);
      registerDestructible(building,scene.children.slice(first),upperStart);
    }
  }
  function cityBlock(gx,gz) {
    const x=gx*40+20, z=gz*40+20, seed=(gx+9)*31+(gz+9)*73;
    if((gx>=-2&&gx<=0&&gz>=-5&&gz<=4)||interestBlock(gx,gz))return;
    const community=communitySites.find(site=>site.x===x&&site.z===z);
    if(community){const first=scene.children.length,upperStart=upperBuildingColliders.length;makeCommunityBuilding(community);registerDestructible(buildings[buildings.length-1],scene.children.slice(first+1),upperStart);return;}
    const landmark=landmarkSites.find(site=>site.x===x&&site.z===z);
    if(landmark){const first=scene.children.length,upperStart=upperBuildingColliders.length;makeLandmark(landmark);registerDestructible(buildings[buildings.length-1],scene.children.slice(first+1),upperStart);return;}
    if(roadCrossesBlock(x,z)) {
      // Pavement follows the avenue rather than leaving the entire block as asphalt.
      curvedBlockPavement(x,z);
      // Smaller corner buildings leave room for the avenue and its pavements.
      for(const dx of [-12,12])for(const dz of [-12,12]) {
        const bx=x+dx,bz=z+dz;
        if(nearCurvedRoad(bx,bz,15))continue;
        const height=11+Math.floor(random(seed+dx+dz)*12),facade=buildingMats[Math.floor(random(seed+dx*3+dz)*4)];
        const tower=facadeBox(9,height,9,facade,bx,height/2+.3,bz);tower.castShadow=true;tower.receiveShadow=true;
        const roof=box(9.4,.4,9.4,stone,bx,height+.5,bz);roof.castShadow=true;
        const building={x:bx,z:bz,w:9,d:9,height:height+.7};buildings.push(building);grappleMeshes.push(tower,roof);
        registerDestructible(building,[tower,roof],upperBuildingColliders.length);
      }
      return;
    }
    const district=districtAt(x,z),districtValue=random(seed+333);
    if((district==='harlem'&&districtValue<.85)||(district==='village'&&districtValue<.5)||(district==='brooklyn'&&districtValue<.85)){rowHouseBlock(x,z,seed,district);return;}
    const pavement=box(29,.45,29,mats.sidewalk,x,.2,z); pavement.receiveShadow=true;
    const firstPart=scene.children.length,upperStart=upperBuildingColliders.length;
    const style=district==='dumbo'||district==='harlem'?6:Math.floor(random(seed+90)*11), value=random(seed);
    const baseHeight=Math.floor(style===0?14+value*10:style===1?25+value*30:style===2?62+value*48:style===3?42+value*38:style===5?46+value*32:style===6?20+value*18:style===7?65+value*45:style===8?55+value*42:style===9?44+value*38:style===10?30+value*30:24+value*42);
    // Each neighborhood has its own skyline: tall Midtown and FiDi, low brick elsewhere.
    const height=Math.floor(district==='uptown'?Math.min(baseHeight,20+value*34):district==='midtown'?Math.max(baseHeight,50+value*70):district==='village'||district==='harlem'?Math.min(baseHeight,14+value*24):
      district==='fidi'?Math.max(baseHeight,48+value*80):district==='dumbo'?16+value*16:district==='downtown-brooklyn'?Math.min(baseHeight,26+value*48):Math.min(baseHeight,14+value*20));
    const w=(style===2||style===7?16:19)+random(seed+1)*7, d=20+random(seed+2)*6;
    const facade=district==='dumbo'||district==='harlem'?buildingMats[4]:buildingMats[style===2?2:style===0?1:style===5?0:style===6?4:style===7||style===8||style===9?5:style===10?3:Math.floor(random(seed+4)*4)];
    const shape=style===8?'round':style===9?'diamond':style===10?'octagon':null;
    const tower=shape?shapedBuilding(x,z,w,d,.45,height,facade,shape):facadeBox(w,height,d,facade,x,height/2+.45,z); tower.castShadow=true; tower.receiveShadow=true;
    const roof=shape?shapedBuilding(x,z,w+1,d+1,height+.25,.7,mats.roof,shape):box(w+1,.7,d+1,mats.roof,x,height+.6,z); roof.castShadow=true; roof.receiveShadow=true;
    if ((gx===1&&gz===0)||(gx===1&&gz===-2)||(gx===-3&&gz===0)) {
      const board=new THREE.Group();board.position.set(x,Math.min(height-4,13),z-d/2-.4);board.rotation.y=Math.PI;scene.add(board);
      box(13.4,7.7,.25,metal,0,0,-.15,board);
      const face=new THREE.Mesh(new THREE.PlaneGeometry(13,7.3),billboardMat);board.add(face);
    }
    // Cornices, lobby glazing, awnings and roof machinery break up the silhouettes.
    if(!shape) {
      box(w+.45,.42,d+.45,stone,x,4.9,z);
      box(w+.75,.42,d+.75,stone,x,height-.3,z);
    }
    if(!shape) {
      box(w*.75,3.2,.12,darkGlass,x,2.4,z-d/2-.08);
      box(1.45,2.55,.11,stone,x,1.72,z-d/2-.16);
      box(1.18,2.25,.12,darkGlass,x,1.62,z-d/2-.23);
      box(.04,2.15,.14,metal,x,1.65,z-d/2-.31);
      box(.12,3.2,d*.75,darkGlass,x-w/2-.08,2.4,z);
      for(let k=-2;k<=2;k++) {
        box(.16,3.2,.18,stone,x+k*w*.14,2.4,z-d/2-.16);
        box(.18,3.2,.16,stone,x-w/2-.16,2.4,z+k*d*.14);
      }
      if(random(seed+12)>.45) {
        box(w*.65,.18,1.3,awning,x,4.15,z-d/2-.7);
        box(w*.65,.25,.08,awning,x,4.03,z-d/2-1.32);
      }
    }
    if(style===1 || style===4) {
      for(const side of [-1,1]) box(.48,height-5,.3,stone,x+side*(w/2-.55),height/2+2.8,z-d/2-.12);
    }
    if (height>32 && !shape) {
      const bulk=box(w*.28,2.5,d*.28,mats.roof,x,height+2,z); bulk.castShadow=true;
      box(w*.2,.3,d*.2,metal,x,height+3.4,z);
      box(.16,4,.16,metal,x+w*.24,height+2.5,z+d*.15);
      if(random(seed+18)>.52) {
        // Roof plant and a low parapet add readable detail when seen from above.
        box(w*.24,1.15,d*.12,metal,x-w*.23,height+1.55,z-d*.23);
        box(w*.24,.12,d*.12,mats.roof,x-w*.23,height+2.16,z-d*.23);
        box(w,.6,.24,stone,x,height+1.1,z-d/2);
        box(.24,.6,d,stone,x-w/2,height+1.1,z);
      }
    }
    if(!shape && random(seed+9)>.57) for(let n=1;n<4;n++) box(w+.25,.16,d+.25,stone,x,5+n*(height-6)/4,z);
    if(style===2 || style===3) {
      const crown=facadeBox(w*.68,style===2?9:5,d*.68,facade,x,height+(style===2?5.4:3.4),z);crown.castShadow=true;grappleMeshes.push(crown);
      if(style===2){box(.22,9,.22,metal,x,height+14,z);box(w*.42,.35,d*.42,stone,x,height+10,z);}
    }
    if(style===0) {
      // A row of brownstone entrances and stoops along the sidewalk.
      for(const offset of [-.28,0,.28]) {
        const doorX=x+offset*w;
        box(1.55,2.7,.12,stone,doorX,1.8,z-d/2-.2);
        box(1.05,2.15,.14,awning,doorX,1.53,z-d/2-.28);
        for(let step=0;step<3;step++)box(2.0,.18,.44,stone,doorX,.48+step*.18,z-d/2-1.25+step*.34);
        for(const side of [-1,1])box(.07,.72,1.15,metal,doorX+side*.98,.93,z-d/2-.91);
      }
      for(let floor=1;floor<=2;floor++) for(const side of [-1,1]) {
        box(.18,.1,d*.65,metal,x+side*(w/2+.25),floor*4+2,z);
        box(.08,.65,d*.65,metal,x+side*(w/2+.5),floor*4+2.4,z);
      }
    }
    if(style===5) {
      // Stepped limestone crowns and vertical ribs evoke Art Deco towers.
      let top=setback(x,z,w*.74,d*.74,height+.95,8,facade);
      top=setback(x,z,w*.48,d*.48,top,7,facade);
      box(w*.30,1.2,d*.30,stone,x,top+.6,z);
      box(.22,6,.22,metal,x,top+4,z);
      for(const side of [-1,1]) {
        box(.32,height-8,.2,stone,x+side*w*.30,height/2+3,z-d/2-.14);
        box(.2,height-8,.32,stone,x-w/2-.14,height/2+3,z+side*d*.30);
      }
    }
    if(style===6) {
      // Brick lofts get a fire escape and a familiar rooftop water tank.
      for(let floor=0;floor<Math.min(5,Math.floor((height-5)/4));floor++) {
        const y=5.5+floor*4;
        box(w*.30,.12,1.2,metal,x,y,z-d/2-.7);
        box(w*.30,.75,.08,metal,x,y+.42,z-d/2-1.25);
        for(const side of [-1,0,1])box(.07,.75,.07,metal,x+side*w*.14,y+.42,z-d/2-1.25);
        if(floor>0)beamBetween(scene,[x+w*.11,y-.05,z-d/2-1.25],[x-w*.11,y-3.95,z-d/2-1.25],.055,metal);
      }
      const tankX=x+w*.2,tankZ=z+d*.2;
      for(const dx of [-.8,.8])for(const dz of [-.8,.8])box(.12,2,.12,metal,tankX+dx,height+1.95,tankZ+dz);
      const tank=new THREE.Mesh(new THREE.CylinderGeometry(1.35,1.35,2.4,12),material(0x806b52));tank.position.set(tankX,height+4,tankZ);tank.castShadow=true;scene.add(tank);
      const tankRoof=new THREE.Mesh(new THREE.ConeGeometry(1.48,.7,12),mats.roof);tankRoof.position.set(tankX,height+5.55,tankZ);scene.add(tankRoof);
    }
    if(style===7) {
      // Slender glass towers use a recessed upper floor and a framed crown.
      const top=setback(x,z,w*.72,d*.72,height+.95,8,facade);
      box(w*.76,.3,d*.76,metal,x,top+.15,z);
      for(const side of [-1,1])box(.18,height-5,.18,metal,x+side*w*.33,height/2+2.5,z-d/2-.08);
      if(random(seed+24)>.45)box(.18,9,.18,metal,x,top+4.5,z);
    }
    if(shape) {
      // Matching faceted setbacks make the roofline as distinctive as the footprint.
      const tierBottom=height+.95,tierHeight=style===8?8:style===9?10:6;
      const tier=shapedBuilding(x,z,w*.65,d*.65,tierBottom,tierHeight,facade,shape);
      const cap=shapedBuilding(x,z,w*.68,d*.68,tierBottom+tierHeight,.4,stone,shape);
      grappleMeshes.push(tier,cap);
      upperBuildingColliders.push({x,z,w:w*.65,d:d*.65,bottom:tierBottom,height:tierBottom+tierHeight+.4,shape});
      if(style!==8)box(.18,7,.18,metal,x,tierBottom+tierHeight+3.9,z);
    }
    const building={x,z,w,d,height:height+.95,style,shape};buildings.push(building);
    grappleMeshes.push(tower,roof);
    if ((gx===-3&&gz===0)||(gx===2&&gz===2)||(gx===-3&&gz===-4)||(gx===4&&gz===-4)) makeCrane(x,z,height+1,random(seed+90)*Math.PI);
    registerDestructible(building,scene.children.slice(firstPart),upperStart);

  }
  for(let gx=-6;gx<6;gx++)for(let gz=-17;gz<23;gz++)cityBlock(gx,gz);
  for(let gx=9;gx<19;gx++)for(let gz=11;gz<26;gz++)cityBlock(gx,gz);
  // Fill the former mid-block streets with pavement, producing long blocks while
  // retaining the individual buildings and their existing collision footprints.
  for(let gx=-5;gx<=5;gx+=2)for(let gz=-6;gz<21;gz++) {
    const x=gx*40,z=gz*40+20;
    if(joinedBlock(x,z))box(11.2,.45,29,mats.sidewalk,x,.2,z).receiveShadow=true;
  }
  // A residential neighborhood connects to the north end of the existing street grid.
  function makeSuburbs() {
    const lawn=material(0x708a60),houseMats=[material(0xc7b9a5),material(0xa26f5d),material(0xc3c5bd),material(0x8e9a94)];
    box(400,.08,240,lawn,0,.04,-360).receiveShadow=true;
    for(let x=-200;x<=200;x+=40)box(10,.03,240,mats.road,x,.10,-360);
    for(let z=-480;z<=-240;z+=40)box(400,.03,10,mats.road,0,.12,z);
    const roofShape=new THREE.Shape();roofShape.moveTo(-5,0);roofShape.lineTo(5,0);roofShape.lineTo(0,3);roofShape.closePath();
    const roofGeometry=new THREE.ExtrudeGeometry(roofShape,{depth:14,bevelEnabled:false});
    const windows=new THREE.MeshStandardMaterial({color:0x647f88,roughness:.35,metalness:.12});
    for(let gx=-5;gx<5;gx++)for(let gz=-12;gz< -6;gz++)for(const side of [-1,1]) {
      const x=gx*40+20+side*7.4,z=gz*40+20,seed=(gx+20)*71+(gz+20)*31+side;
      const first=scene.children.length,upperStart=upperBuildingColliders.length;
      box(3,.025,6,mats.sidewalk,x,.145,z-12);
      const height=random(seed+9)>.6?6.8:4.6,roofMat=random(seed+13)>.5?mats.roof:awning;
      const body=box(10,height,14,houseMats[Math.floor(random(seed)*houseMats.length)],x,.15+height/2,z);body.castShadow=true;body.receiveShadow=true;
      const roof=new THREE.Mesh(roofGeometry,roofMat);roof.position.set(x,height+.15,z-7);roof.scale.y=.75+random(seed+19)*.35;roof.castShadow=true;scene.add(roof);
      box(1.15,2.2,.12,awning,x,1.25,z-7.08);
      for(const dx of [-3,3]){box(1.45,1.35,.12,stone,x+dx,2.5,z-7.08);box(1.2,1.1,.13,windows,x+dx,2.5,z-7.16);}
      for(const dx of [-3,3]) {
        box(1.35,1.25,.1,windows,x+dx,2.5,z+7.07);
        if(height>6)box(1.15,1.0,.1,windows,x+dx,5,z-7.07);
      }
      for(const face of [-1,1])for(const dz of [-3.5,3.5])box(.1,1.25,1.35,windows,x+face*5.07,2.5,z+dz);
      const house={x,z,w:10,d:14,height:height+.15,suburb:true,modelVariant:(gx*13+gz*7+(side>0?1:0)+300)%3};buildings.push(house);grappleMeshes.push(body,roof);
      registerDestructible(house,scene.children.slice(first+1),upperStart);
    }
  }
  const playerBuildingColliders=buildings.concat(upperBuildingColliders);
  // Index static footprints once; destroyed buildings are still filtered by
  // insideBuilding, so destruction does not require rebuilding the index.
  const buildingCells=new Map();
  for(const building of buildings) {
    const minX=Math.floor((building.x-building.w/2-2)/40),maxX=Math.floor((building.x+building.w/2+2)/40);
    const minZ=Math.floor((building.z-building.d/2-2)/40),maxZ=Math.floor((building.z+building.d/2+2)/40);
    for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++) {
      const key=`${x},${z}`;if(!buildingCells.has(key))buildingCells.set(key,[]);
      buildingCells.get(key).push(building);
    }
  }
  for(const road of curvedRoads)buildCurvedRoad(road);
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
  const roadMarks=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mats.line,markMatrices.length);
  markMatrices.forEach((matrix,i)=>roadMarks.setMatrixAt(i,matrix));const markCount=markMatrices.length;
  roadMarks.count=markCount;roadMarks.computeBoundingSphere();scene.add(roadMarks);
  // Street details give the blocks scale from eye level.
  const taxiMat=new THREE.MeshStandardMaterial({color:0xdba831,roughness:.32,metalness:.35});
  const carPaints=[taxiMat,new THREE.MeshStandardMaterial({color:0x53636d,roughness:.34,metalness:.38}),new THREE.MeshStandardMaterial({color:0xb9b9b3,roughness:.35,metalness:.3}),new THREE.MeshStandardMaterial({color:0x7a3434,roughness:.38,metalness:.3})];
  const carGlass=new THREE.MeshStandardMaterial({color:0x263b46,roughness:.18,metalness:.48}), lampMat=material(0x404c50);
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
  const metalTrim=new THREE.MeshStandardMaterial({color:0x9aabae,roughness:.28,metalness:.7});
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
  const shirts=[fabric(0x385878),fabric(0x865a51),fabric(0x6d765d),fabric(0x55515f),fabric(0x8e7d69)];
  const skinMats=[material(0xd5a47e),material(0x946044),material(0x664632),material(0xe0b99c)];
  const trousers=[fabric(0x343c48),fabric(0x3e5061),fabric(0x49433f)];
  const hairMats=[material(0x282522),material(0x493328),material(0x837263)];
  const shoeMat=material(0x292b2e), eyeMat=material(0x292827);
  const roundGeo=new THREE.SphereGeometry(1,16,12);
  function oval(parent,mat,x,y,z,sx,sy,sz) {
    const mesh=new THREE.Mesh(roundGeo,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh;
  }
  function makePedestrian(x,z,seed,blockX,blockZ) {
    const group=new THREE.Group();group.position.set(x,.45,z);scene.add(group);
    const shirt=shirts[Math.floor(random(seed+10)*shirts.length)],skin=skinMats[Math.floor(random(seed+20)*skinMats.length)];
    const pants=trousers[Math.floor(random(seed+30)*trousers.length)],hair=hairMats[Math.floor(random(seed+40)*hairMats.length)];
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
    const limbs=[];
    for(const side of [-1,1]) {
      const leg=new THREE.Group();leg.position.set(side*.105,.77,0);group.add(leg);
      oval(leg,pants,0,-.19,0,.095,.25,.09);
      const knee=new THREE.Group();knee.position.y=-.38;leg.add(knee);leg.userData.knee=knee;
      oval(knee,pants,0,-.10,0,.075,.21,.075);oval(knee,shoeMat,0,-.32,-.055,.09,.07,.15);limbs.push(leg);
    }
    for(const side of [-1,1]) {
      const arm=new THREE.Group();arm.position.set(side*.23,1.36,0);group.add(arm);
      oval(arm,shirt,0,-.15,0,.075,.21,.075);oval(arm,skin,0,-.35,0,.056,.15,.056);oval(arm,skin,0,-.51,0,.06,.075,.045);limbs.push(arm);
    }
    oval(group,skin,0,1.44,0,.075,.07,.07);
    if(random(seed+71)>.68)oval(group,pants,0,1.08,.17,.19,.28,.10);
    if(random(seed+73)>.75)box(.31,.045,.25,hair,0,1.81,-.015,group);
    if(random(seed+75)>.82)box(.13,.20,.09,mats.white,.34,.81,0,group);
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
    const person={group,head,leftLeg:limbs[0],rightLeg:limbs[1],leftArm:limbs[2],rightArm:limbs[3],
      route,blockX,blockZ,target:direction===1?0:3,direction,speed:1.05+random(seed+4)*.45,seed,step:0,pause:random(seed+7)*2,hx:.34,hz:.34,top:2.3,uprightTop:2.3,webRemaining:0,webPose:0,visit:null,stuck:false};
    group.userData.actor=person;pedestrians.push(person);return person;
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
      const forearm=oval(arm,coatMat,side*.025,-.34,-.17,.07,.21,.07);forearm.rotation.x=-.85;
      oval(arm,skin,side*.03,-.45,-.32,.06,.055,.075);limbs.push(arm);
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
  const grassMat=new THREE.MeshStandardMaterial({map:parkTexture('#687d54',['#6e8558','#5b714d','#819065','#566d4c'],9),roughness:1});
  const pathMat=new THREE.MeshStandardMaterial({map:parkTexture('#b9af9b',['#b0a591','#c8bfab','#a49b8c','#c1b6a1'],5),roughness:1});
  const woodMat=material(0x806144),parkMetal=material(0x3e5046);
  const foliageTexture=parkTexture('#a5ad8c',['#8d9b79','#c0c6a3','#778866','#aab997'],1);
  const parkLeaves=[0x456c47,0x638654,0x526f42,0x77945d,0x8c8350].map(color=>new THREE.MeshStandardMaterial({color,map:foliageTexture,roughness:1}));
  const birchBark=material(0xc1bcb0),pineNeedles=material(0x345c46),birchMark=material(0x5e6258);
  const waterMat=new THREE.MeshStandardMaterial({color:0x5c8990,roughness:.24,metalness:.24});
  const canopyGeometry=new THREE.IcosahedronGeometry(1,2),pineGeometry=new THREE.ConeGeometry(1,1,10);
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
  const parkStructures=[];
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
  function bench(x,z,angle=0) {
    const group=new THREE.Group();group.position.set(x,inPark(x,z) ? .09+parkElevation(x,z) : .45,z);group.rotation.y=angle;group.userData.targetable=true;scene.add(group);
    chargeProps.push({group,kind:'prop',hx:1,hz:.5,top:1.4,seed:x+z});
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
      const leaf=parkLeaves[(Math.floor(random(seed+146)*parkLeaves.length)+(kind===1?1:0))%parkLeaves.length];
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
      const vertices=geometry.attributes.position;
      for(let i=0;i<vertices.count;i++)vertices.setY(i,.061+parkElevation(x+vertices.getX(i),z+vertices.getZ(i)));
      geometry.computeVertexNormals();const hill=new THREE.Mesh(geometry,grassMat);hill.position.set(x,0,z);hill.receiveShadow=true;hill.userData.parkLandmark='wooded-rise';scene.add(hill);
    }
    const pathEdge=material(0x989582),lawnMat=new THREE.MeshStandardMaterial({color:0xdde8d2,map:grassMat.map,roughness:1}),meadowMat=new THREE.MeshStandardMaterial({color:0xe1e8d8,map:grassMat.map,roughness:1});
    function ellipse(x,z,rx,rz,mat,y,name) {
      const mesh=new THREE.Mesh(new THREE.CircleGeometry(1,64),mat);mesh.rotation.x=-Math.PI/2;mesh.scale.set(rx,rz,1);mesh.position.set(x,y,z);
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
    const shrubs=new THREE.InstancedMesh(canopyGeometry,parkLeaves[0],160),transform=new THREE.Object3D();let shrubsPlaced=0;
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
    box(1.55,.65,.8,metalTrim,0,.75,0,cart);box(1.65,.1,.9,mats.white,0,1.12,0,cart);
    for(const side of [-.55,.55]){const wheel=new THREE.Mesh(new THREE.TorusGeometry(.20,.04,8,16),rubber);wheel.rotation.y=Math.PI/2;wheel.position.set(side,.2,0);cart.add(wheel);}
    box(.07,1.5,.07,metalTrim,0,1.9,0,cart);
    for(let i=0;i<8;i++){const roof=new THREE.Mesh(new THREE.ConeGeometry(1.25,.48,4,1,false,i*Math.PI/4,Math.PI/4),i%2?mats.white:awning);roof.position.y=2.76;cart.add(roof);}
    const label=new THREE.Mesh(new THREE.PlaneGeometry(1.3,.42),vendorSign);label.position.set(0,.78,-.42);label.rotation.y=Math.PI;cart.add(label);
    for(let i=-1;i<=1;i++){const roll=oval(cart,bun,i*.37,1.22,0,.15,.07,.25);const dog=oval(cart,sausage,i*.37,1.28,0,.055,.05,.21);}
    const vendor=makePedestrian(x,z+.95,seed,blockX,blockZ);vendor.settled=true;vendor.vendor=true;vendor.group.rotation.y=0;if(inPark(x,z))vendor.group.position.y=.09;
  }
  let featuredHydrant=null;
  const hydrants=[];
  function streetDetails(x,z,seed) {
    if(random(seed+301)>.63){const hydrant=new THREE.Group();hydrant.position.set(x+6.25,.45,z+9);hydrant.userData.targetable=true;scene.add(hydrant);hydrants.push(hydrant);const body=new THREE.Mesh(new THREE.CylinderGeometry(.16,.19,.55,12),fireRed);body.position.y=.28;hydrant.add(body);const cap=new THREE.Mesh(new THREE.SphereGeometry(.16,12,8),fireRed);cap.position.y=.57;hydrant.add(cap);box(.48,.12,.12,fireRed,0,.36,0,hydrant);if(!featuredHydrant || hydrant.position.lengthSq()<featuredHydrant.position.lengthSq())featuredHydrant=hydrant;}
    if(random(seed+302)>.7){const bin=new THREE.Mesh(new THREE.CylinderGeometry(.28,.24,.65,12),parkMetal);bin.position.set(x+6.3,.78,z-9);scene.add(bin);}
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
  const protestMaterials=['NO GLEEPING','STOP GLOBBING','END GLEEPING & GLOBBING'].map(message=>{
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#e8dfc9';ctx.fillRect(0,0,512,256);
    ctx.strokeStyle='#9e7051';ctx.lineWidth=12;ctx.strokeRect(6,6,500,244);
    ctx.fillStyle='#442f2a';ctx.textAlign='center';ctx.textBaseline='middle';
    if(message.startsWith('END')){ctx.font='bold 62px sans-serif';ctx.fillText('END GLEEPING',256,88);ctx.font='bold 54px sans-serif';ctx.fillText('& GLOBBING',256,165);}
    else {ctx.font='bold 65px sans-serif';const words=message.split(' ');ctx.fillText(words[0],256,88);ctx.fillText(words[1],256,166);}
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({map:texture,roughness:1,side:THREE.FrontSide});
  });
  function makeProtest() {
    for(let i=0;i<9;i++) {
      const column=i%3,row=Math.floor(i/3),ox=(column-1)*1.5,oz=row*1.6;
      const person=makePedestrian(15+ox,4+oz,7700+i,-40,-40);
      person.protester=true;person.parkWalker=true;person.group.position.y=.1+parkElevation(person.group.position.x,person.group.position.z);
      person.route=[{x:15+ox,z:4+oz},{x:15+ox,z:-24+oz},{x:23+ox,z:-24+oz},{x:23+ox,z:4+oz}];
      person.target=1;person.direction=1;person.speed=1.25;person.pause=0;
      box(.055,1.45,.055,woodMat,0,.22,0,person.rightArm);
      const signGeometry=new THREE.PlaneGeometry(1.35,.68),signMaterial=protestMaterials[i%protestMaterials.length];
      for(const side of [-1,1]) {
        const sign=new THREE.Mesh(signGeometry,signMaterial);
        sign.position.set(0,1.1,side*.04);if(side<0)sign.rotation.y=Math.PI;
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
    // The suspension bridge stays within the playable map and can be grappled.
    const bridge=new THREE.Group();bridge.position.set(206,.08,22);bridge.userData.interestKind='waterfront-bridge';bridge.userData.targetable=true;scene.add(bridge);
    box(50,.28,7,plazaStone,25,.14,0,bridge);
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
      box(50,.08,.1,metalTrim,25,1.05,zz,bridge);
    }
    bridge.traverse(child=>{if(child.isMesh)grappleMeshes.push(child);});
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
    // The Brooklyn approach steps down gently so you can run off the bridge.
    const steps=28;
    for(let i=0;i<steps;i++) {
      const x0=east+(rampEnd-east)*i/steps,x1=east+(rampEnd-east)*(i+1)/steps,y=deckY*(1-(i+1)/steps)+.45;
      const step=box(x1-x0+.05,.5,12,bridgeDeck,(x0+x1)/2,y-.25,z);step.receiveShadow=true;collider((x0+x1)/2,z,x1-x0,12,y-.8,y,true);
    }
    for(const [x,w] of [[west+8,16],[east-6,12]]) {
      const anchorage=box(w,deckY+1.5,16,bridgeStone,x,(deckY+1.5)/2-.75,z);anchorage.castShadow=true;grappleMeshes.push(anchorage);
      buildings.push({x,z,w,d:16,height:deckY+.75});collider(x,z,w,16,-2,deckY+.75,true);
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
    for(let i=0;i<5;i++){const fort=box(34,6,34,bridgeStone,0,3,0,site);fort.rotation.y=i*Math.PI*2/10;}
    box(16,24,16,bridgeStone,0,18,0,site);box(18,1.2,18,mats.white,0,30.6,0,site);box(12,6,12,bridgeStone,0,33.8,0,site);
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
  // Times Square: giant glowing billboards with ads nobody asked for.
  const timesSquareScreens=[];
  function billboardCanvas(lines,colors) {
    const image=document.createElement('canvas');image.width=512;image.height=320;const c=image.getContext('2d');
    const grad=c.createLinearGradient(0,0,512,320);grad.addColorStop(0,colors[0]);grad.addColorStop(1,colors[1]);c.fillStyle=grad;c.fillRect(0,0,512,320);
    c.textAlign='center';c.fillStyle='#fff';c.shadowColor='rgba(0,0,0,.5)';c.shadowBlur=8;
    c.font='900 64px Arial Black, Arial';c.fillText(lines[0],256,120);c.font='bold 30px Arial';c.fillText(lines[1],256,185);c.font='bold 24px Arial';c.fillStyle='#ffe98a';c.fillText(lines[2]||'',256,250);
    const texture=new THREE.CanvasTexture(image);texture.colorSpace=THREE.SRGBColorSpace;return texture;
  }
  const newsTicker={canvas:document.createElement('canvas'),texture:null,text:'WELCOME TO NEW YORK  •  WATCH FOR FALLING CIVILIANS  •  HOT DOGS NOW $14  •  ',offset:0};
  newsTicker.canvas.width=2048;newsTicker.canvas.height=64;newsTicker.texture=new THREE.CanvasTexture(newsTicker.canvas);newsTicker.texture.colorSpace=THREE.SRGBColorSpace;
  newsTicker.texture.wrapS=THREE.RepeatWrapping;
  function setNews(text) {
    newsTicker.text=`${text}  •  `;const c=newsTicker.canvas.getContext('2d');
    c.fillStyle='#0b0b12';c.fillRect(0,0,2048,64);c.fillStyle='#ff4747';c.font='900 40px Arial';c.textBaseline='middle';
    let x=10;while(x<2048){c.fillText(newsTicker.text,x,34);x+=c.measureText(newsTicker.text).width;}newsTicker.texture.needsUpdate=true;
  }
  setNews('LIVE FROM TIMES SQUARE  •  SPIDER-MENACE SPOTTED  •  HOT DOGS NOW $14  •  RENT: YES');
  function makeTimesSquare() {
    const ads=[[['SPIDER-MENACE','Caught on camera AGAIN','Daily Bugle • 50¢'],['#b3122b','#2a0b14']],[['HIT BY A SPIDER?','Call 1-800-STICKY','Lawyers who actually call back'],['#1d5bd8','#0b1638']],
      [['CATS 2: DOGS','Now playing on Broadway','"Why?" — Everyone'],['#7a2bd1','#1b0b33']],[['HOT DOGS','$14. Do not ask.','Since 1916-ish'],['#f2a22a','#5a2a06']],
      [['I ♥ NY','Tolerate NY','Fine, love-ish NY'],['#ffffff','#d8263a']],[['NEW YEAR\'S EVE','Only 61 days of standing','Bring diapers'],['#18a07d','#062b22']]];
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
    if(person.rooftopKind==='view') {poseSittingLegs(person,1.25);person.leftArm.rotation.x=-.15;person.rightArm.rotation.x=-.15;}
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
        const worker=makePedestrian(b.x,z,1700+i,blockX,blockZ);worker.group.position.y=height+.1;worker.group.rotation.y=Math.PI;
        worker.settled=true;worker.rooftop=true;worker.rooftopKind='washer';
        oval(worker.head,mustard,0,.2,0,.16,.055,.15);
        box(.055,.58,.055,metalTrim,0,-.65,0,worker.rightArm);box(.32,.06,.07,metalTrim,0,-.96,0,worker.rightArm);
        if(!b.washers)b.washers=[];b.washers.push({platform,worker,cables,origin:platform.position.clone(),roof:b.height,fall:null});
      } else {
        const viewer=makePedestrian(b.x+b.w/2-.65,b.z,1800+i,blockX,blockZ);
        viewer.group.position.y=b.height-.55;viewer.group.rotation.y=-Math.PI/2;
        viewer.settled=true;viewer.rooftop=true;viewer.rooftopKind='view';rooftopRest(viewer);
      }
    }
  }
  addRooftopScenes();
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
  function makeRhino() {
    const group=new THREE.Group();group.position.set(0,0,-29);scene.add(group);
    const armorCanvas=document.createElement('canvas');armorCanvas.width=128;armorCanvas.height=128;
    const ac=armorCanvas.getContext('2d');ac.fillStyle='#888';ac.fillRect(0,0,128,128);ac.strokeStyle='#666';ac.lineWidth=1.2;
    for(let y=0;y<144;y+=16)for(let x=(y%32?0:-12);x<140;x+=24) {ac.beginPath();ac.moveTo(x,y);ac.lineTo(x+6,y+8);ac.lineTo(x+18,y+8);ac.lineTo(x+24,y);ac.stroke();}
    const armorTexture=new THREE.CanvasTexture(armorCanvas);armorTexture.wrapS=armorTexture.wrapT=THREE.RepeatWrapping;armorTexture.repeat.set(3,3);
    const armor=new THREE.MeshStandardMaterial({color:0x5b6265,roughness:.76,metalness:.24,bumpMap:armorTexture,bumpScale:.035});
    const darkArmor=new THREE.MeshStandardMaterial({color:0x30383c,roughness:.8,metalness:.18,bumpMap:armorTexture,bumpScale:.025});
    const hornMat=new THREE.MeshStandardMaterial({color:0xc1b9a3,roughness:.62});
    const skin=material(0x9b7767);
    const body=new THREE.Group();body.position.y=2.45;group.add(body);
    oval(body,armor,0,0,0,1.18,1.28,.72);oval(body,darkArmor,0,-.68,0,.87,.42,.64);
    oval(body,darkArmor,0,.15,-.61,.70,.76,.15);oval(body,armor,0,.15,-.72,.52,.60,.09);
    for(const y of [-.25,.05,.35])box(1.1,.055,.06,darkArmor,0,y,-.79,body);
    const head=new THREE.Group();head.position.set(0,.98,-.10);body.add(head);
    oval(head,armor,0,0,0,.68,.76,.63);oval(head,skin,0,-.22,-.55,.39,.25,.12);
    for(const side of [-1,1]) {
      oval(head,darkArmor,side*.30,.03,-.52,.12,.075,.045);
      oval(head,hornMat,side*.30,.04,-.565,.045,.025,.015);
      oval(head,armor,side*.65,.34,.01,.22,.20,.22);
    }
    const horn=new THREE.Mesh(new THREE.ConeGeometry(.25,.95,12),hornMat);horn.position.set(0,.30,-.73);horn.rotation.x=-.82;head.add(horn);
    const limbs=[];
    for(const side of [-1,1]) {
      const arm=new THREE.Group();arm.position.set(side*1.02,.5,0);body.add(arm);
      oval(arm,armor,side*.22,-.17,0,.49,.52,.51);oval(arm,darkArmor,side*.31,-.30,-.37,.31,.29,.13);oval(arm,armor,side*.30,-.72,-.04,.38,.56,.40);oval(arm,darkArmor,side*.30,-1.14,-.12,.40,.29,.40);limbs.push(arm);
      const leg=new THREE.Group();leg.position.set(side*.52,1.52,0);group.add(leg);
      oval(leg,armor,0,-.38,0,.46,.62,.46);oval(leg,darkArmor,0,-1.05,-.12,.39,.25,.56);limbs.push(leg);
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
  function makeVillain(kind,x,y,z) {
    const group=new THREE.Group();group.position.set(x,y,z);scene.add(group);
    const goblin=kind==='goblin',electro=kind==='electro';
    const suit=material(goblin?0x593a76:electro?0x174e65:0x435638);
    const accent=material(goblin?0x718c42:electro?0xe7bd35:0x75614a);
    const darkSuit=material(goblin?0x312744:electro?0x173743:0x2e3930);
    const face=material(goblin?0x849e4b:electro?0xe4b34b:0xb9937d);
    const eye=new THREE.MeshBasicMaterial({color:electro?0xc9ffff:0xf3dfb0});
    const body=new THREE.Group();body.position.y=1.30;group.add(body);
    const torso=new THREE.Mesh(new THREE.CylinderGeometry(goblin?.34:electro?.41:.55,goblin?.27:electro?.31:.48,1.05,8),suit);
    torso.scale.z=goblin?.72:electro?.75:.68;body.add(torso);
    oval(body,darkSuit,0,-.55,0,goblin?.32:.42,.19,.25);
    box(goblin?.65:.8,.11,.38,accent,0,-.48,0,body);
    const head=new THREE.Group();head.position.y=.84;body.add(head);
    oval(head,face,0,0,0,goblin?.24:.27,.32,.24);
    const arms=[],elbows=[],legs=[],knees=[];
    for(const side of [-1,1]) {
      oval(head,eye,side*.105,.04,-.218,.065,.034,.023);
      const brow=box(.18,.045,.06,darkSuit,side*.11,.105,-.22,head);brow.rotation.z=-side*.25;
      const arm=new THREE.Group();arm.position.set(side*(goblin?.34:electro?.40:.51),.35,0);body.add(arm);
      oval(arm,suit,side*.04,-.17,0,electro?.12:.16,.27,.14);
      const elbow=new THREE.Group();elbow.position.set(side*.04,-.37,0);arm.add(elbow);
      oval(elbow,suit,0,-.17,0,.12,.24,.12);oval(elbow,accent,0,-.37,-.02,.13,.14,.12);
      for(let finger=0;finger<3;finger++)oval(elbow,accent,(finger-1)*.07,-.47,-.04,.035,.10,.035);
      const leg=new THREE.Group();leg.position.set(side*(goblin?.19:.24),.78,0);group.add(leg);
      oval(leg,suit,0,-.21,0,goblin?.13:.17,.28,.14);
      const knee=new THREE.Group();knee.position.y=-.39;leg.add(knee);
      oval(knee,suit,0,-.16,0,.12,.24,.12);oval(knee,accent,0,-.36,-.08,.15,.11,goblin?.30:.22);
      arms.push(arm);elbows.push(elbow);legs.push(leg);knees.push(knee);
    }
    const limbs=[];let glow=null,glider=null;
    if(kind==='goblin') {
      const hood=new THREE.Mesh(new THREE.ConeGeometry(.31,.65,8),suit);hood.position.set(0,.42,.04);hood.rotation.x=-.28;head.add(hood);
      oval(head,face,0,-.16,-.20,.17,.11,.13);
      for(const side of [-1,1]){const ear=new THREE.Mesh(new THREE.ConeGeometry(.12,.55,8),accent);ear.position.set(side*.29,.12,.02);ear.rotation.z=-side*1.05;head.add(ear);}
      const strap=box(.11,1.0,.05,accent,.05,0,-.26,body);strap.rotation.z=.55;
      box(.30,.25,.17,darkSuit,.34,-.38,-.15,body);
      glider=new THREE.Group();glider.position.y=.06;group.add(glider);
      const wingShape=new THREE.Shape();wingShape.moveTo(-3.3,.35);wingShape.lineTo(-1.2,-1.05);wingShape.lineTo(-.5,-.8);wingShape.lineTo(0,-1.7);wingShape.lineTo(.5,-.8);wingShape.lineTo(1.2,-1.05);wingShape.lineTo(3.3,.35);wingShape.lineTo(.8,.7);wingShape.lineTo(0,1.2);wingShape.lineTo(-.8,.7);wingShape.closePath();
      const wing=new THREE.Mesh(new THREE.ExtrudeGeometry(wingShape,{depth:.16,bevelEnabled:true,bevelSize:.06,bevelThickness:.04,bevelSegments:1}),accent);wing.rotation.x=-Math.PI/2;glider.add(wing);
      box(1.2,.23,1.9,darkSuit,0,.12,0,glider);
      for(const side of [-1,1]){const fin=box(.12,.38,1.1,darkSuit,side*1.25,.24,.1,glider);fin.rotation.z=side*.35;oval(glider,goblinBombMaterial,side*.58,.08,.95,.25,.18,.3);}
    } else if(kind==='electro') {
      for(let i=0;i<7;i++) {const a=i*Math.PI*2/7,spike=new THREE.Mesh(new THREE.ConeGeometry(.09,.55,5),accent);spike.position.set(Math.sin(a)*.32,Math.cos(a)*.31,-.10);spike.rotation.z=-a;head.add(spike);}
      for(const side of [-1,1]) {box(.12,.75,.045,accent,side*.28,0,-.27,body);box(.11,.32,.11,accent,side*.28,.38,-.20,body);}
      const boltShape=new THREE.Shape();boltShape.moveTo(.03,.48);boltShape.lineTo(-.20,-.05);boltShape.lineTo(-.03,-.05);boltShape.lineTo(-.12,-.46);boltShape.lineTo(.23,.12);boltShape.lineTo(.04,.12);boltShape.closePath();
      const bolt=new THREE.Mesh(new THREE.ShapeGeometry(boltShape),new THREE.MeshBasicMaterial({color:0xa8f6ff,side:THREE.DoubleSide}));bolt.position.z=-.34;body.add(bolt);
      glow=oval(body,electroShotMaterial,0,.05,-.26,.09,.12,.02);
    } else {
      oval(head,hairMats[1],0,.24,.03,.29,.14,.26);
      for(const side of [-1,1]){oval(head,darkGlass,side*.12,.04,-.235,.12,.09,.045);const lens=oval(head,metalTrim,side*.12,.04,-.27,.08,.06,.015);lens.rotation.z=side*.1;}
      box(.11,.08,.06,metalTrim,0,.04,-.26,head);
      for(const side of [-1,1]) {
        const lapel=box(.17,.78,.06,accent,side*.20,.05,-.34,body);lapel.rotation.z=side*.26;
        const coatTail=box(.34,.5,.28,suit,side*.25,-.72,.07,body);coatTail.rotation.z=side*.1;
      }
      box(.7,.42,.25,metalTrim,0,.18,.28,body);
      for(const side of [-1,1])for(const upper of [-1,1]) {
        const base=new THREE.Group();base.position.set(side*.58,upper>0?1.75:1.1,.42);group.add(base);
        // Start behind the harness and sweep outward before curving toward the front.
        base.rotation.y=-side*1.25;base.rotation.x=upper>0?.55:-.2;
        let joint=base;const joints=[base];
        for(let k=0;k<3;k++) {
          oval(joint,metalTrim,0,0,0,.18,.18,.18);
          const segment=box(.22,.22,1.8,metalTrim,0,0,-.9,joint);segment.castShadow=true;
          for(const z0 of [-.45,-.9,-1.35])box(.27,.27,.06,darkSuit,0,0,z0,joint);
          const next=new THREE.Group();next.position.z=-1.8;joint.add(next);joint=next;joints.push(next);
        }
        joints.claws=[];
        for(const clawSide of [-1,1]){const claw=new THREE.Group();claw.position.x=clawSide*.16;joint.add(claw);box(.12,.14,.65,metalTrim,0,0,-.3,claw);claw.rotation.y=clawSide*.5;joints.claws.push(claw);}
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
    const colors=[];
    for(let i=0;i<positions.length;i+=3) {
      const sleeve=values[i+1]<-.02; const color=new THREE.Color(sleeve?0x213d66:0xb82b31);
      colors.push(color.r,color.g,color.b);
      flip(point.set(values[i],values[i+1],values[i+2]));
      positions[i]=point.x;positions[i+1]=point.y;positions[i+2]=point.z;
    }
    const geometry=new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3)); geometry.computeVertexNormals();
    group.add(new THREE.Mesh(geometry,gloveMat));
    group.position.set(side*.47,-.59,-1.0); return group;
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
  const webLines=[];
  for(let strand=0;strand<3;strand++) {
    const geometry=new THREE.BufferGeometry().setFromPoints(Array.from({length:25},()=>new THREE.Vector3()));
    const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:strand===0?0xffffff:0xb7cdd1,transparent:true,opacity:strand===0?.95:.75}));
    line.visible=false; scene.add(line); webLines.push(line);
  }
  // A camera-facing ribbon gives the main strand real thickness at any distance.
  const ribbonPositions=new Float32Array(25*2*3),ribbonGeometry=new THREE.BufferGeometry();
  ribbonGeometry.setAttribute('position',new THREE.BufferAttribute(ribbonPositions,3));
  {const index=[];for(let i=0;i<24;i++){const j=i*2;index.push(j,j+1,j+2,j+1,j+3,j+2);}ribbonGeometry.setIndex(index);}
  const webRibbon=new THREE.Mesh(ribbonGeometry,new THREE.MeshBasicMaterial({color:0xf4fdff,side:THREE.DoubleSide,transparent:true,opacity:.92,depthWrite:false}));
  webRibbon.frustumCulled=false;webRibbon.visible=false;webRibbon.userData.projectile=true;webRibbon.raycast=()=>{};scene.add(webRibbon);
  const ribbonA=new THREE.Vector3(),ribbonB=new THREE.Vector3(),ribbonC=new THREE.Vector3(),ribbonSide=new THREE.Vector3();
  function updateWebRibbon() {
    const source=webLines[0].geometry.attributes.position;
    for(let i=0;i<=24;i++) {
      ribbonA.fromBufferAttribute(source,i);ribbonB.fromBufferAttribute(source,Math.max(0,i-1));ribbonC.fromBufferAttribute(source,Math.min(24,i+1));
      ribbonSide.subVectors(ribbonC,ribbonB).cross(ribbonB.subVectors(ribbonA,camera.position));
      if(ribbonSide.lengthSq()<1e-10)ribbonSide.set(0,1,0);
      ribbonSide.normalize().multiplyScalar(.032*(1-.45*i/24));
      ribbonPositions[i*6]=ribbonA.x+ribbonSide.x;ribbonPositions[i*6+1]=ribbonA.y+ribbonSide.y;ribbonPositions[i*6+2]=ribbonA.z+ribbonSide.z;
      ribbonPositions[i*6+3]=ribbonA.x-ribbonSide.x;ribbonPositions[i*6+4]=ribbonA.y-ribbonSide.y;ribbonPositions[i*6+5]=ribbonA.z-ribbonSide.z;
    }
    ribbonGeometry.attributes.position.needsUpdate=true;
  }
  // A ring shows where the next web would attach before you fire it.
  const anchorPreview=(()=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const g=canvas.getContext('2d');
    g.strokeStyle='#fff';g.lineWidth=5;g.beginPath();g.arc(32,32,24,0,Math.PI*2);g.stroke();g.fillStyle='#fff';g.beginPath();g.arc(32,32,5,0,Math.PI*2);g.fill();
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,opacity:.75,depthTest:false,sizeAttenuation:false}));
    sprite.scale.setScalar(.03);sprite.visible=false;sprite.renderOrder=10;sprite.raycast=()=>{};scene.add(sprite);return sprite;
  })();
  const raycaster=new THREE.Raycaster(); raycaster.far=110;
  function showWeb(visible) { for(const line of webLines) line.visible=visible; webRibbon.visible=visible; }
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
  let wallContact=null,wallRunTime=0,wallCooldown=0,zipTime=0,zipCooldown=0,zipAnchor=null;
  let recentDanger=null;
  let rescue=null,rescueTimer=10,rescueSequence=0;
  const rescueNotice=document.getElementById('rescue-notice');let rescueNoticeTimer=null;
  function hideRescueNotice() {if(rescueNoticeTimer!==null)clearTimeout(rescueNoticeTimer);rescueNoticeTimer=null;rescueNotice.hidden=true;}
  function showRescueNotice(type) {
    hideRescueNotice();
    rescueNotice.textContent=type==='fall'?'Catch the falling person: hold left click, aim at a surface, and release.':'Stop the runaway vehicle: web it to a surface or use web bombs.';
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
  let chaosScore=0,comboPoints=0,comboMultiplier=1,comboTimer=0,opinion=50,trickSpin=0,trickDirection=1,gravityScale=1;
  let timeScale=1,slowMotion=false,hitStop=0,screenShake=0,slapCooldown=0,slapAnimation=0,previewTimer=0,rainTimer=3;
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
    revive:['...I\'m okay!','I\'M FINE','Walk it off, Gary','Cartoon physics, baby','Back from the dead, still late']
  };
  const opinionTiers=[[0,'PUBLIC ENEMY #1'],[15,'MENACE'],[30,'NUISANCE'],[45,'MID'],[60,'FRIENDLY-ISH'],[75,'NEIGHBORHOOD HERO'],[90,'LITERAL ANGEL']];
  function adjustOpinion(amount) {
    opinion=THREE.MathUtils.clamp(opinion+amount,0,100);
    let tier=opinionTiers[0][1];for(const [threshold,name] of opinionTiers)if(opinion>=threshold)tier=name;
    if(opinionLabel){opinionLabel.textContent=tier;opinionBar.style.width=`${opinion}%`;opinionBar.style.background=opinion<30?'#ff5b4f':opinion<60?'#ffc75e':'#6ff09a';}
  }
  // Each award extends the combo; the multiplier grows with the chain.
  function awardChaos(points,label,point=null,kind='hit') {
    comboPoints+=points;comboTimer=3.5;comboMultiplier=Math.min(10,comboMultiplier+(kind==='trick'?.5:1));
    if(chaosFeed) {
      const row=document.createElement('div');row.className=`feed-row ${kind}`;row.textContent=`${label} +${points}`;chaosFeed.prepend(row);
      while(chaosFeed.children.length>5)chaosFeed.lastChild.remove();setTimeout(()=>row.classList.add('fade'),1600);setTimeout(()=>row.remove(),2300);
    }
    if(point)worldPopup(label,point,`burst ${kind}`,1.1);
    if(kind==='hit')adjustOpinion(-1.5);else if(kind==='hero')adjustOpinion(8);else if(kind==='oops')adjustOpinion(-6);
    updateComboLabel();
  }
  function updateComboLabel() {
    if(!comboLabel)return;
    comboLabel.textContent=comboPoints?`${comboPoints.toLocaleString()} × ${Math.floor(comboMultiplier)}`:'';
    comboLabel.classList.toggle('hot',comboMultiplier>=5);
  }
  function updateChaos(dt) {
    if(comboTimer>0) {
      comboTimer-=dt;
      if(comboTimer<=0) {
        const banked=Math.round(comboPoints*Math.floor(comboMultiplier));chaosScore+=banked;
        if(banked>=1500)worldPopup(`COMBO ${banked.toLocaleString()}!`,camera.position.clone().add(new THREE.Vector3(-Math.sin(yaw)*6,1.2,-Math.cos(yaw)*6)),'burst combo',1.6);
        comboPoints=0;comboMultiplier=1;updateComboLabel();
        if(chaosScore>=250000)unlockNuke('250,000 CHAOS');
        if(chaosScoreLabel)chaosScoreLabel.textContent=chaosScore.toLocaleString();
      }
    }
  }
  const popups=[],popupPoint=new THREE.Vector3();
  function worldPopup(text,point,className,life=1.4,follow=null) {
    if(!popupLayer)return;
    const element=document.createElement('div');element.className=`popup ${className}`;element.textContent=text;popupLayer.appendChild(element);
    popups.push({element,point:point.clone(),follow,life,age:0,rise:className==='speech'?.25:1.8});
    if(popups.length>28){const old=popups.shift();old.element.remove();}
  }
  function say(actor,kind,chance=1) {
    if(Math.random()>chance || !actor?.group || actor.group.position.distanceTo(position)>60)return;
    if(actor.lastSpoke && elapsed-actor.lastSpoke<2.2)return;actor.lastSpoke=elapsed;
    worldPopup(pick(lines[kind]),actor.group.position.clone().add(new THREE.Vector3(0,2.6,0)),'speech',2.3,actor);
  }
  function updatePopups(dt) {
    for(let i=popups.length-1;i>=0;i--) {
      const popup=popups[i];popup.age+=dt;
      if(popup.age>=popup.life){popup.element.remove();popups.splice(i,1);continue;}
      if(popup.follow)popup.point.copy(popup.follow.group.position).y+=2.6;
      popupPoint.copy(popup.point);popupPoint.y+=popup.rise*popup.age;
      const distance=popupPoint.distanceTo(camera.position);popupPoint.project(camera);
      const visible=popupPoint.z<1 && Math.abs(popupPoint.x)<1.1 && Math.abs(popupPoint.y)<1.1;
      popup.element.style.display=visible?'':'none';if(!visible)continue;
      const scale=THREE.MathUtils.clamp(16/Math.max(distance,1),.45,1.4)*(popup.element.classList.contains('burst')?1+.4*Math.max(0,1-popup.age*6):1);
      popup.element.style.transform=`translate(${(popupPoint.x*.5+.5)*innerWidth}px,${(-popupPoint.y*.5+.5)*innerHeight}px) translate(-50%,-100%) scale(${scale.toFixed(3)})`;
      popup.element.style.opacity=String(Math.min(1,(popup.life-popup.age)*3));
    }
  }
  // Synthesized vowel-ish voices: a sawtooth through two formant filters.
  function playVoice(point,kind='yelp') {
    if(!effectsEnabled || !soundContext || soundContext.state!=='running' || paused)return;
    const distance=point?point.distanceTo(position):0,volume=Math.max(0,1-distance/90);if(volume<=0)return;
    const now=soundContext.currentTime,scream=kind==='scream',length=scream?1.1+Math.random()*.5:kind==='yelp'?.32:.22;
    const base=scream?330+Math.random()*300:kind==='yelp'?260+Math.random()*260:110+Math.random()*80;
    const voice=soundContext.createOscillator(),vibrato=soundContext.createOscillator(),depth=soundContext.createGain(),gain=soundContext.createGain();
    voice.type='sawtooth';voice.frequency.setValueAtTime(base*(scream?1.15:1.3),now);voice.frequency.exponentialRampToValueAtTime(base*(scream?.6:.7),now+length);
    vibrato.frequency.value=scream?6+Math.random()*4:14;depth.gain.value=base*(scream?.05:.03);vibrato.connect(depth);depth.connect(voice.frequency);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.09*volume,now+.03);gain.gain.setValueAtTime(.09*volume,now+length*.7);gain.gain.exponentialRampToValueAtTime(.0001,now+length);
    for(const [frequency,level] of [[scream?850:700,1],[scream?1300:1150,.6]]) {
      const formant=soundContext.createBiquadFilter(),mix=soundContext.createGain();formant.type='bandpass';formant.frequency.value=frequency;formant.Q.value=4;mix.gain.value=level*2.2;
      voice.connect(formant);formant.connect(mix);mix.connect(gain);
    }
    gain.connect(effectsBus);voice.start(now);vibrato.start(now);voice.stop(now+length);vibrato.stop(now+length);
  }
  // Pooled soft point particles for dust, splashes, confetti and impact sparks.
  const particleMax=900,particlePosition=new Float32Array(particleMax*3),particleColor=new Float32Array(particleMax*3),particleSize=new Float32Array(particleMax),particleAlpha=new Float32Array(particleMax);
  const particles=Array.from({length:particleMax},()=>({life:0,max:1,velocity:new THREE.Vector3(),gravity:0,drag:0,size:1}));let particleCursor=0;
  const particleGeometry=new THREE.BufferGeometry();
  particleGeometry.setAttribute('position',new THREE.BufferAttribute(particlePosition,3));particleGeometry.setAttribute('color',new THREE.BufferAttribute(particleColor,3));
  particleGeometry.setAttribute('size',new THREE.BufferAttribute(particleSize,1));particleGeometry.setAttribute('alpha',new THREE.BufferAttribute(particleAlpha,1));
  const particleMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{viewport:{value:innerHeight*renderer.getPixelRatio()}},
    vertexShader:'attribute float size;attribute float alpha;attribute vec3 color;uniform float viewport;varying float vAlpha;varying vec3 vColor;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=size*projectionMatrix[1][1]*viewport*.5/max(-mv.z,.1);vAlpha=alpha;vColor=color;}',
    fragmentShader:'varying float vAlpha;varying vec3 vColor;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(vColor,vAlpha*smoothstep(.5,.2,d));}'});
  const particleSystem=new THREE.Points(particleGeometry,particleMaterial);particleSystem.frustumCulled=false;particleSystem.userData.projectile=true;particleSystem.raycast=()=>{};scene.add(particleSystem);
  const burstColor=new THREE.Color();
  function burst(point,count,color,{speed=6,up=4,life=.8,gravity=12,size=.35,drag=1.5,spread=.3}={}) {
    const colors=Array.isArray(color)?color:[color];
    for(let n=0;n<count;n++) {
      const i=particleCursor;particleCursor=(particleCursor+1)%particleMax;const particle=particles[i];
      particle.life=particle.max=life*(.6+Math.random()*.6);particle.gravity=gravity;particle.drag=drag;particle.size=size*(.6+Math.random()*.8);
      particle.velocity.set(Math.random()*2-1,Math.random()*2-1,Math.random()*2-1).normalize().multiplyScalar(speed*(.3+Math.random()*.7));particle.velocity.y+=up*Math.random();
      particlePosition[i*3]=point.x+(Math.random()-.5)*spread;particlePosition[i*3+1]=point.y+(Math.random()-.5)*spread;particlePosition[i*3+2]=point.z+(Math.random()-.5)*spread;
      burstColor.set(colors[n%colors.length]);particleColor[i*3]=burstColor.r;particleColor[i*3+1]=burstColor.g;particleColor[i*3+2]=burstColor.b;
    }
  }
  function updateParticles(dt) {
    for(let i=0;i<particleMax;i++) {
      const particle=particles[i];
      if(particle.life<=0){particleAlpha[i]=0;continue;}
      particle.life-=dt;particle.velocity.y-=particle.gravity*dt;particle.velocity.multiplyScalar(Math.exp(-particle.drag*dt));
      particlePosition[i*3]+=particle.velocity.x*dt;particlePosition[i*3+1]+=particle.velocity.y*dt;particlePosition[i*3+2]+=particle.velocity.z*dt;
      const t=Math.max(0,particle.life/particle.max);particleAlpha[i]=Math.min(1,t*2.5);particleSize[i]=particle.size*(.5+.5*t);
    }
    for(const name of ['position','color','size','alpha'])particleGeometry.attributes[name].needsUpdate=true;
  }
  const confetti=[0xff4f6d,0xffd25e,0x5ee0ff,0x8dff7a,0xc68bff,0xffffff];
  // Speed streaks on a 2D overlay sell velocity far better than FOV alone.
  const speedLines=document.getElementById('speed-lines'),speedContext=speedLines?.getContext('2d'),streaks=[];
  function updateSpeedLines(dt,speed) {
    if(!speedContext)return;
    const w=speedLines.width=Math.round(innerWidth/2),h=speedLines.height=Math.round(innerHeight/2),amount=THREE.MathUtils.smoothstep(speed,24,62)*(slowMotion?.4:1);
    if(amount<=0 && !streaks.length)return;
    while(streaks.length<70*amount)streaks.push({angle:Math.random()*Math.PI*2,radius:.35+Math.random()*.3,length:.08+Math.random()*.14,speed:1.6+Math.random()*1.8});
    speedContext.lineCap='round';
    for(let i=streaks.length-1;i>=0;i--) {
      const streak=streaks[i];streak.radius+=streak.speed*dt;
      if(streak.radius>1.15){if(streaks.length>70*amount)streaks.splice(i,1);else{streak.radius=.35+Math.random()*.2;streak.angle=Math.random()*Math.PI*2;}continue;}
      const cx=w/2,cy=h/2,scale=Math.hypot(w,h)/2,x1=cx+Math.cos(streak.angle)*streak.radius*scale,y1=cy+Math.sin(streak.angle)*streak.radius*scale;
      const x2=cx+Math.cos(streak.angle)*(streak.radius+streak.length)*scale,y2=cy+Math.sin(streak.angle)*(streak.radius+streak.length)*scale;
      speedContext.strokeStyle=`rgba(255,255,255,${(.32*amount*Math.min(1,(streak.radius-.35)*4)).toFixed(3)})`;speedContext.lineWidth=1+streak.length*8;
      speedContext.beginPath();speedContext.moveTo(x1,y1);speedContext.lineTo(x2,y2);speedContext.stroke();
    }
  }
  function updateMutators(dt) {
    gravityScale=mutators.moon?.38:1;
    if(!mutators.raining || nuke)return;
    rainTimer-=dt;if(rainTimer>0)return;
    rainTimer=2+Math.random()*2.5;
    // It's raining men: borrow a passer-by and drop them from the sky nearby.
    const candidates=pedestrians.filter(n=>!n.dead&&!n.knockback&&!n.webHeld&&!n.webPinned&&!n.settled&&!n.rooftop&&!n.wheelchair&&!n.dog&&n.group.visible&&n!==rescue?.actor&&n.group.position.distanceTo(position)>60);
    if(!candidates.length)return;
    const npc=pick(candidates),x=THREE.MathUtils.clamp(position.x+(Math.random()-.5)*50+velocity.x*1.5,worldMinX+8,worldMaxX-8),z=THREE.MathUtils.clamp(position.z+(Math.random()-.5)*50+velocity.z*1.5,worldMinZ+5,worldMaxZ-5);
    if((buildingCells.get(`${Math.floor(x/40)},${Math.floor(z/40)}`)||[]).some(b=>insideBuilding(x,z,b,1)) || waterAt(x,z))return;
    cancelVisit(npc);cancelDonation(npc);npc.group.position.set(x,Math.max(position.y+30,45)+Math.random()*25,z);
    npc.knockback={ground:inPark(x,z)?.1+parkElevation(x,z):.45,velocity:new THREE.Vector3(0,-2,0),spin:2.5,time:0,lethal:true};say(npc,'fly');
  }
  function setMutator(name,value) {
    mutators[name]=value;
    if(name==='bobble')for(const npc of pedestrians)npc.head.scale.setScalar(value?2.5:1);
    const button=document.querySelector(`[data-mutator="${name}"]`);if(button){button.setAttribute('aria-pressed',String(value));button.classList.toggle('on',value);}
  }
  document.querySelectorAll('[data-mutator]').forEach(button=>button.addEventListener('click',()=>setMutator(button.dataset.mutator,!mutators[button.dataset.mutator])));
  function impactFeedback(strength) {hitStop=Math.max(hitStop,Math.min(.09,.03+strength*.012));screenShake=Math.min(1.2,screenShake+strength*.12);}
  // Spider-slap: a short melee cone that sends anything in front flying.
  function spiderSlap() {
    if(slapCooldown>0 || paused)return;
    slapCooldown=.32;slapAnimation=.3;playEffect('slap');
    const forward=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
    const flat=new THREE.Vector3(forward.x,0,forward.z).normalize();let hits=0;
    for(const actor of [...pedestrians,...cars,...chargeProps]) {
      if(actor.dead || !actor.group.visible)continue;
      const p=actor.group.position,dx=p.x-position.x,dz=p.z-position.z,dy=p.y-position.y,reach=cars.includes(actor)?4.5+Math.max(actor.hx,actor.hz):3.6;
      const d=Math.hypot(dx,dz);if(d>reach || Math.abs(dy)>3)continue;
      if(d>.6 && (dx*flat.x+dz*flat.z)/d<.45)continue;
      const car=cars.includes(actor),power=car?20:30;
      const launch=new THREE.Vector3(flat.x*power,car?11:13+Math.max(0,forward.y)*12,flat.z*power).addScaledVector(velocity,.5);
      if(actor.webHeld)cancelWebGrab();if(actor.webPinned){clearWebPin(actor);releaseActorWeb(actor);}
      throwActor(actor,flat,false,launch);hits++;
      const point=p.clone().add(new THREE.Vector3(0,1.2,0));burst(point,14,[0xfff2a8,0xffffff],{speed:9,up:3,life:.4,gravity:4,size:.28});
      if(pedestrians.includes(actor)){awardChaos(120,pick(['SPIDER-SLAP','BACKHAND','DISRESPECT','POW!']),point);say(actor,'hit',.8);playVoice(p,'yelp');}
      else if(car)awardChaos(300,'CAR SLAP',point);
      else awardChaos(200,pick(['BENCH PRESS','PUBLIC SEATING YEET','PARKS DEPT. CRYING']),point);
    }
    for(const hydrant of hydrants) {
      const dx=hydrant.position.x-position.x,dz=hydrant.position.z-position.z,d=Math.hypot(dx,dz);
      if(d<2.8 && Math.abs(hydrant.position.y-position.y)<2 && (d<.6 || (dx*flat.x+dz*flat.z)/d>.3)){burstHydrant(hydrant);hits++;}
    }
    for(const boss of bosses) {
      const a=boss.actor,p=a.group.position;if(boss.status!=='active')continue;
      const dx=p.x-position.x,dz=p.z-position.z,d=Math.hypot(dx,dz);
      if(d>(a===rhino?5.5:4.5) || Math.abs(p.y-position.y)>4 || (d>.6 && (dx*flat.x+dz*flat.z)/d<.4) || elapsed-(boss.lastSlap||-9)<.55)continue;
      boss.lastSlap=elapsed;
      damageBoss(a,1,a.state==='subdued'?'BOSS SMACKDOWN':'BOSS SLAP',p.clone().setY(p.y+2.5));hits++;
      if(boss.status==='active' && a.state!=='subdued'){p.x+=flat.x*2;p.z+=flat.z*2;}
    }
    if(hits){impactFeedback(2+hits);playEffect('impact');if(hits>=3)awardChaos(250*hits,`MULTI-SLAP x${hits}`,null);}
  }
  // ---- Villains: district bosses with health bars, news alerts and a trip to jail ----
  const bossBar=document.getElementById('boss-bar'),bossNameLabel=document.getElementById('boss-name'),bossTitleLabel=document.getElementById('boss-title'),bossHealth=document.getElementById('boss-health'),bossTag=document.getElementById('boss-tag');
  const breaking=document.getElementById('breaking'),breakingText=document.getElementById('breaking-text'),villainTracker=document.getElementById('villain-tracker');
  const beaconGeometry=new THREE.CylinderGeometry(2.2,2.2,300,12,1,true);
  const alertVerbs=['IS WRECKING','IS TERRORIZING','IS HAVING A NORMAL ONE IN','IS LOOSE IN','IS RUINING BRUNCH IN','IS DOING CRIMES IN'];
  const bosses=[
    {actor:rhino,name:'RHINO',title:'Has never once paid for a fender bender',district:'CENTRAL PARK',color:0xff665f,hp:20,home:new THREE.Vector3(0,0,-29)},
    {actor:villains.find(v=>v.kind==='electro'),name:'ELECTRO',title:'Stealing power from the Times Square billboards',district:'TIMES SQUARE',color:0x80eeff,hp:16},
    {actor:villains.find(v=>v.kind==='goblin'),name:'GREEN GOBLIN',title:'Pumpkin-bombing Midtown commuters',district:'MIDTOWN',color:0xa8ff6c,hp:18},
    {actor:villains.find(v=>v.kind==='octopus'),name:'DOC OCK',title:'Robbing Wall Street with four extra arms',district:'THE FINANCIAL DISTRICT',color:0xffc75e,hp:22}
  ].map(def=>{
    const beacon=new THREE.Mesh(beaconGeometry,new THREE.MeshBasicMaterial({color:def.color,transparent:true,opacity:.2,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));
    beacon.visible=false;beacon.userData.projectile=true;beacon.raycast=()=>{};scene.add(beacon);
    const boss={...def,home:def.home||def.actor.spawn.clone(),maxHp:def.hp,status:'dormant',beacon,timer:0,jailTime:0,rampage:3,defeats:0};
    def.actor.boss=boss;return boss;
  });
  let alertTimer=25,nukeUnlocked=false,focusBoss=null;const villainsBeaten=new Set();
  try{nukeUnlocked=localStorage.getItem('spida.nukeUnlocked')==='1';}catch(_){/* Storage can be unavailable; the unlock then lasts this session. */}
  let breakingTimer=null;
  function showBreaking(text) {
    if(!breaking)return;
    breakingText.textContent=text;breaking.hidden=false;breaking.classList.remove('show');void breaking.offsetWidth;breaking.classList.add('show');
    clearTimeout(breakingTimer);breakingTimer=setTimeout(()=>{breaking.hidden=true;},4800);
  }
  function sleepBoss(boss) {
    const a=boss.actor;boss.status='dormant';a.group.visible=false;boss.beacon.visible=false;a.group.position.copy(boss.home);a.enraged=false;
  }
  function activateBoss(boss,announce=true) {
    if(boss.status!=='dormant')return;
    const a=boss.actor;boss.status='active';boss.hp=boss.maxHp;a.group.visible=true;a.group.position.copy(boss.home);a.group.rotation.set(0,0,0);
    a.state=a===rhino?'roam':'idle';a.timer=1;a.stuck=false;a.webHits=0;a.enraged=false;releaseActorWeb(a);
    if(announce) {
      showBreaking(`${boss.name} ${pick(alertVerbs)} ${boss.district}`);
      setNews(`BREAKING: ${boss.name} SPOTTED IN ${boss.district}  •  ${boss.title.toUpperCase()}  •  NYPD "MONITORING THE SITUATION"  •  SPIDER-MENACE NOWHERE TO BE FOUND`);
      playEffect('alert');
    }
    updateVillainTracker();
  }
  // Every third of a boss's health knocks them out briefly, which doubles the damage they take.
  function damageBoss(actor,amount,label,point=null) {
    const boss=actor?.boss;if(!boss || boss.status!=='active')return false;
    const before=boss.hp,stunned=actor.state==='subdued';boss.hp=Math.max(0,boss.hp-amount*(stunned?1.5:1));focusBoss=boss;boss.lastHit=elapsed;
    const where=point||actor.group.position.clone().setY(actor.group.position.y+3);
    if(label)awardChaos(Math.round(amount*(stunned?240:120)),label,where,'trick');
    burst(where,12,[boss.color,0xffffff],{speed:7,life:.45,size:.35});
    if(boss.hp<=0){defeatBoss(boss);return true;}
    const third=boss.maxHp/3;
    if(!stunned && Math.ceil(boss.hp/third)<Math.ceil(before/third)) {
      actor.state='subdued';actor.stuck=true;actor.webRemaining=3;actor.timer=0;worldPopup('STUNNED! SLAP THEM!',where,'burst trick',1.6);playEffect('impact');
    }
    if(!actor.enraged && boss.hp<=boss.maxHp/2){actor.enraged=true;worldPopup(`${boss.name} IS ENRAGED`,where.clone().setY(where.y+1.5),'burst oops',1.8);}
    return true;
  }
  function defeatBoss(boss) {
    const a=boss.actor,p=a.group.position;boss.status='defeated';boss.jailTime=0;boss.defeats++;villainsBeaten.add(boss.name);
    if(webGrab===a)cancelWebGrab();clearWebPin(a);
    a.state='subdued';a.stuck=true;a.webRemaining=1e6;
    const wrap=wrapActor(a.group,a);if(a===rhino)wrap.scale.set(2.6,2.2,2.5);else wrap.scale.set(1.35,1.4,1.4);wrap.userData.webActor=a;splatters.push(wrap);
    awardChaos(5000,`${boss.name} DEFEATED`,p.clone().setY(p.y+4),'hero');burst(p.clone().setY(p.y+3),70,confetti,{speed:12,up:8,life:1.8,size:.35});
    showBreaking(`${boss.name} WEBBED UP. NYPD TAKES ALL THE CREDIT.`);setNews(`${boss.name} CAPTURED  •  SPIDER-MAN "PROBABLY HELPED"  •  CITY BILLS HIM FOR DAMAGES`);
    playEffect('success');impactFeedback(3);adjustOpinion(12);
    if(villainsBeaten.size===bosses.length)unlockNuke('EVERY VILLAIN BEATEN');
    updateVillainTracker();
  }
  function unlockNuke(reason) {
    if(nukeUnlocked)return;nukeUnlocked=true;
    try{localStorage.setItem('spida.nukeUnlocked','1');}catch(_){/* Keep the unlock for this session only. */}
    setTimeout(()=>showBreaking(`☢ NUKE UNLOCKED: ${reason}. PRESS N. PLEASE DON'T.`),2500);updateVillainTracker();
  }
  function updateVillainTracker() {
    if(villainTracker)villainTracker.innerHTML=bosses.map(b=>`<span class="${villainsBeaten.has(b.name)?'beaten':b.status==='active'?'active':''}" style="--villain:#${b.color.toString(16).padStart(6,'0')}">${b.name}</span>`).join('')+
      `<span class="nuke-state ${nukeUnlocked?'ready':''}">${nukeUnlocked?'☢ NUKE READY':`☢ LOCKED ${villainsBeaten.size}/${bosses.length}`}</span>`;
    nukeButton.classList.toggle('locked',!nukeUnlocked);
    nukeButton.title=nukeUnlocked?'Launch nuke':`Locked: beat every villain (${villainsBeaten.size}/${bosses.length}) or cause 250,000 chaos`;
  }
  function updateBosses(dt) {
    if(nuke)return;
    const actors=[...cars,...pedestrians.filter(n=>!n.dead)];let nearest=null,nearestDistance=170;
    for(const boss of bosses) {
      const a=boss.actor,p=a.group.position;
      if(boss.status==='dormant') {
        boss.timer=Math.max(0,boss.timer-dt);
        if(boss.timer===0 && Math.hypot(position.x-boss.home.x,position.z-boss.home.z)<85)activateBoss(boss);
        continue;
      }
      if(boss.status==='defeated') {
        // The webbed villain floats off to jail, then comes back angrier later.
        boss.jailTime+=dt;boss.beacon.visible=false;
        if(boss.jailTime>3 && a.group.visible){p.y+=dt*(3+(boss.jailTime-3)*5);a.group.rotation.y+=dt*2.5;if(boss.jailTime>3.05&&boss.jailTime<3.1)worldPopup('OFF TO THE RAFT ✈',p.clone().setY(p.y+4),'burst hero',2);}
        if(boss.jailTime>9 && a.group.visible){releaseActorWeb(a);a.stuck=false;sleepBoss(boss);boss.status='jailed';boss.timer=150;boss.maxHp=Math.round(boss.maxHp*1.3);}
        continue;
      }
      if(boss.status==='jailed'){boss.timer-=dt;if(boss.timer<=0){boss.status='dormant';boss.timer=0;updateVillainTracker();}continue;}
      const distance=Math.hypot(position.x-p.x,position.z-p.z);
      boss.beacon.visible=distance>45;boss.beacon.position.set(p.x,150,p.z);boss.beacon.material.opacity=.14+.08*Math.sin(elapsed*4);
      if(distance<nearestDistance){nearest=boss;nearestDistance=distance;}
      // Left alone, a villain wrecks its neighborhood.
      boss.rampage-=dt;
      if(boss.rampage<=0 && distance>60) {
        boss.rampage=3+Math.random()*3;
        const victims=pedestrians.filter(n=>!n.dead && !n.knockback && n.group.visible && Math.hypot(n.group.position.x-p.x,n.group.position.z-p.z)<45);
        if(victims.length){const target=pick(victims).group.position.clone();enemyFlash(target,4,a.kind==='electro');enemyBlast(target,4,actors,a.kind==='electro');}
      }
    }
    alertTimer-=dt;
    if(alertTimer<=0) {
      alertTimer=50+Math.random()*35;
      const sleeping=bosses.filter(b=>b.status==='dormant');
      if(sleeping.length && bosses.filter(b=>b.status==='active').length<2)activateBoss(pick(sleeping));
    }
    if(focusBoss && (focusBoss.status!=='active' || elapsed-(focusBoss.lastHit||0)>8))focusBoss=null;
    const shown=focusBoss||nearest;
    if(bossBar) {
      bossBar.hidden=!shown;
      if(shown) {
        bossNameLabel.textContent=shown.name;bossTitleLabel.textContent=shown.title;bossHealth.style.width=`${shown.hp/shown.maxHp*100}%`;
        bossHealth.style.background=`#${shown.color.toString(16).padStart(6,'0')}`;
        bossTag.textContent=shown.actor.state==='subdued'?'STUNNED':shown.actor.enraged?'ENRAGED':'';bossTag.className=shown.actor.state==='subdued'?'stunned':shown.actor.enraged?'enraged':'';
      }
    }
  }
  function movement() {
    const strafe=(keys.right?1:0)-(keys.left?1:0), forward=(keys.forward?1:0)-(keys.back?1:0);
    return new THREE.Vector3(strafe*Math.cos(yaw)-forward*Math.sin(yaw),0,-strafe*Math.sin(yaw)-forward*Math.cos(yaw));
  }
  // Browsers require a player gesture before audio can start.
  let soundContext=null, musicEnabled=true, musicTimer=null, musicStep=0, nextMusicNote=0;
  let nukeMusic=null,nukeBoom=null,nukeScreams=null,nukeCrowdLayer=null,nukeFallTone=null,nukeFallGain=null;
  const musicToggle=document.getElementById('music-toggle');
  // A swingy, retro cartoon theme with a brief nod to the classic opening.
  const musicBeat=60/144, musicChords=[[48,51,55],[48,51,57],[53,56,60],[55,59,62]];
  const musicMelody=[
    67,72,75,null, 67,72,75,null, 67,68,67,65, 63,65,67,null,
    72,null,75,77, 78,77,75,null, 72,70,68,67, 65,67,70,null,
    75,null,77,78, 79,78,77,null, 75,72,70,68, 67,65,63,null,
    65,null,68,72, 70,68,65,null, 67,71,74,77, 75,72,67,null
  ];
  let windGain=null,windFilter=null,musicBus=null,effectsBus=null,effectsEnabled=true,noiseBuffer=null,footstepTime=0,ambientSoundTime=3;
  const effectsToggle=document.getElementById('effects-toggle');
  effectsToggle.addEventListener('click',()=>{
    effectsEnabled=!effectsEnabled;
    effectsToggle.textContent=`Sound effects: ${effectsEnabled?'On':'Off'}`;
    effectsToggle.setAttribute('aria-pressed',String(effectsEnabled));
    if(effectsBus)effectsBus.gain.setTargetAtTime(effectsEnabled?1:0,soundContext.currentTime,.015);
    for(const audio of [nukeBoom,nukeScreams,nukeCrowdLayer])if(audio)audio.muted=!effectsEnabled;
  });
  // Short synthesized effects share one bus and a cached noise source.
  const effectPresets={
    web:[.13,760,240,'triangle',.07,.035],release:[.12,330,160,'sine',.035,.02],
    zip:[.25,260,850,'sawtooth',.045,.035],bomb:[.12,440,180,'square',.035,.025],
    splat:[.16,250,90,'triangle',.055,.07],jump:[.15,160,300,'sine',.04,.025],
    land:[.17,125,55,'sine',.075,.08],step:[.09,130,75,'sine',.018,.025],
    glide:[.3,350,160,'sine',.025,.04],impact:[.25,120,45,'sawtooth',.08,.09],
    collapse:[.6,90,38,'sawtooth',.1,.12],electric:[.2,1050,280,'square',.035,.055],
    enemy:[.17,250,480,'sawtooth',.035,.035],alert:[.25,390,600,'triangle',.045,0],
    success:[.4,550,880,'triangle',.045,0],failure:[.4,300,120,'triangle',.045,0],
    horn:[.3,210,205,'square',.025,0],bird:[.16,1250,1900,'sine',.025,0],
    slap:[.1,1400,380,'square',.02,.16],boing:[.45,180,620,'sine',.07,0]
  };
  function playEffect(kind,source=null) {
    if(!effectsEnabled || !soundContext || soundContext.state!=='running' || document.hidden || paused)return;
    const preset=effectPresets[kind];if(!preset)return;
    const distance=source?Math.hypot(source.x-position.x,source.y-position.y,source.z-position.z):0;
    const volume=Math.max(0,1-distance/130);if(volume<=0)return;
    const [duration,start,end,type,toneLevel,noiseLevel]=preset,now=soundContext.currentTime;
    const envelope=soundContext.createGain();envelope.gain.setValueAtTime(.0001,now);
    envelope.gain.exponentialRampToValueAtTime(volume,now+.008);
    envelope.gain.exponentialRampToValueAtTime(.0001,now+duration);
    envelope.connect(effectsBus);
    if(toneLevel) {
      const oscillator=soundContext.createOscillator(),level=soundContext.createGain();
      oscillator.type=type;oscillator.frequency.setValueAtTime(start,now);oscillator.frequency.exponentialRampToValueAtTime(end,now+duration);
      level.gain.value=toneLevel;oscillator.connect(level);level.connect(envelope);oscillator.start(now);oscillator.stop(now+duration);
    }
    if(noiseLevel && noiseBuffer) {
      const noise=soundContext.createBufferSource(),filter=soundContext.createBiquadFilter(),level=soundContext.createGain();
      noise.buffer=noiseBuffer;filter.type='lowpass';filter.frequency.value=Math.max(350,start*2);
      level.gain.value=noiseLevel;noise.connect(filter);filter.connect(level);level.connect(envelope);noise.start(now);noise.stop(now+duration);
    }
  }
  function musicTone(note,time,duration,volume,type,cutoff) {
    const voice=soundContext.createOscillator(),filter=soundContext.createBiquadFilter(),gain=soundContext.createGain();
    voice.type=type;voice.frequency.setValueAtTime(440*Math.pow(2,(note-69)/12),time);
    filter.type='lowpass';filter.frequency.value=cutoff;
    gain.gain.setValueAtTime(.0001,time);
    gain.gain.exponentialRampToValueAtTime(volume,time+.025);
    gain.gain.exponentialRampToValueAtTime(volume*.65,time+Math.min(.18,duration*.5));
    gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
    voice.connect(filter);filter.connect(gain);gain.connect(musicBus);
    voice.start(time);voice.stop(time+duration+.01);
  }
  function scheduleMusic() {
    if(!soundContext || soundContext.state!=='running' || !musicEnabled || document.hidden || nuke)return;
    const now=soundContext.currentTime;
    if(nextMusicNote<now)nextMusicNote=now;
    while(nextMusicNote<now+.15) {
      const step=musicStep%64, bar=Math.floor(step/8), beat=step%8;
      const chord=musicChords[bar%musicChords.length], note=musicMelody[step];
      if(note!==null)musicTone(note,nextMusicNote,musicBeat*.65,.028,'triangle',2000);
      if(beat===0) {
        for(const tone of chord)musicTone(tone,nextMusicNote,musicBeat*3.6,.012,'triangle',1100);
      }
      if(beat%2===0)musicTone((beat===0?chord[0]:beat===2?chord[1]:beat===4?chord[2]:chord[1])-12,nextMusicNote,musicBeat*.8,.045,'sine',500);
      if(beat%2===0)musicTone(36,nextMusicNote,.12,.018,'sine',300);
      musicStep++;nextMusicNote+=musicBeat*(beat%2===0?2/3:1/3);
    }
  }
  musicToggle.addEventListener('click',()=>{
    musicEnabled=!musicEnabled;
    musicToggle.textContent=`Music: ${musicEnabled?'On':'Off'}`;
    musicToggle.setAttribute('aria-pressed',String(musicEnabled));
    if(musicEnabled){nextMusicNote=0;unlockSound();if(nuke && !paused)playNukeMusic();else scheduleMusic();}
    else if(nukeMusic)nukeMusic.pause();
    if(musicBus && soundContext)musicBus.gain.setTargetAtTime(musicEnabled?1:0,soundContext.currentTime,.015);
  });
  function unlockSound() {
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)return;
    try {
      if(!soundContext){
        soundContext=new Audio();musicBus=soundContext.createGain();musicBus.gain.value=musicEnabled?1:0;musicBus.connect(soundContext.destination);
        effectsBus=soundContext.createGain();effectsBus.gain.value=effectsEnabled?1:0;effectsBus.connect(soundContext.destination);
        noiseBuffer=soundContext.createBuffer(1,Math.ceil(soundContext.sampleRate*.65),soundContext.sampleRate);
        const samples=noiseBuffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
        // Wind rushes louder and brighter with speed.
        const windBuffer=soundContext.createBuffer(1,soundContext.sampleRate*4,soundContext.sampleRate),wind=windBuffer.getChannelData(0);
        let brown=0;for(let i=0;i<wind.length;i++){brown=(brown+.02*(Math.random()*2-1))/1.02;wind[i]=brown*3.5;}
        const windSource=soundContext.createBufferSource();windSource.buffer=windBuffer;windSource.loop=true;
        windFilter=soundContext.createBiquadFilter();windFilter.type='bandpass';windFilter.Q.value=.6;windFilter.frequency.value=300;
        windGain=soundContext.createGain();windGain.gain.value=0;windSource.connect(windFilter);windFilter.connect(windGain);windGain.connect(effectsBus);windSource.start();
      }
      if(soundContext.state==='suspended')soundContext.resume().catch(()=>{});
      if(!musicTimer)musicTimer=setInterval(scheduleMusic,80);
    } catch(_) { /* The game remains playable if audio is unavailable. */ }
  }
  function prepareNukeAudio() {
    if(nukeMusic || !soundContext)return;
    nukeMusic=new Audio('assets/audio/nuke-dread.ogg');nukeMusic.preload='auto';
    // Web Audio silences media-element sources loaded through file:// in Chrome.
    // Play those elements directly in that case, using a pre-amplified boom.
    const localFile=location.protocol==='file:';
    nukeBoom=new Audio(localFile?'assets/audio/nuke-boom-boosted.wav':'assets/audio/nuke-boom.wav');nukeBoom.preload='auto';
    nukeScreams=new Audio('assets/audio/nuke-crowd.mp3');nukeScreams.preload='auto';
    nukeCrowdLayer=new Audio('assets/audio/nuke-crowd-layer.mp3');nukeCrowdLayer.preload='auto';
    for(const audio of [nukeBoom,nukeScreams,nukeCrowdLayer])audio.muted=!effectsEnabled;
    if(localFile){nukeMusic.volume=1;nukeBoom.volume=1;nukeScreams.volume=.3;nukeCrowdLayer.volume=.18;return;}
    nukeCrowdLayer.volume=.65;
    const musicGain=soundContext.createGain(),boomGain=soundContext.createGain(),screamGain=soundContext.createGain(),distanceFilter=soundContext.createBiquadFilter();
    musicGain.gain.value=1;boomGain.gain.value=1.5;screamGain.gain.value=.25;distanceFilter.type='lowpass';distanceFilter.frequency.value=1900;
    soundContext.createMediaElementSource(nukeMusic).connect(musicGain);musicGain.connect(soundContext.destination);
    soundContext.createMediaElementSource(nukeBoom).connect(boomGain);boomGain.connect(effectsBus);
    soundContext.createMediaElementSource(nukeScreams).connect(distanceFilter);
    soundContext.createMediaElementSource(nukeCrowdLayer).connect(distanceFilter);distanceFilter.connect(screamGain);screamGain.connect(effectsBus);
  }
  function playNukeMusic() {
    if(!musicEnabled)return;unlockSound();prepareNukeAudio();
    if(nukeMusic)nukeMusic.play().catch(()=>{});
  }
  // A rising wind and descending whistle follow the actual falling phase.
  function startNukeFallSound() {
    if(nukeFallTone || !soundContext || soundContext.state!=='running')return;
    nukeFallTone=soundContext.createOscillator();nukeFallTone.type='sine';
    nukeFallGain=soundContext.createGain();nukeFallGain.gain.value=.0001;
    nukeFallTone.connect(nukeFallGain);nukeFallGain.connect(soundContext.destination);nukeFallTone.start();
  }
  function updateNukeFallSound(progress) {
    if(!nukeFallTone)startNukeFallSound();if(!nukeFallTone)return;
    const now=soundContext.currentTime;
    nukeFallTone.frequency.setTargetAtTime(1100-800*progress,now,.08);
    nukeFallGain.gain.setTargetAtTime(.02+.09*progress,now,.12);
  }
  function stopNukeFallSound() {
    if(!nukeFallTone)return;
    const now=soundContext.currentTime;nukeFallGain.gain.cancelScheduledValues(now);
    nukeFallGain.gain.setTargetAtTime(.0001,now,.025);nukeFallTone.stop(now+.15);
    nukeFallTone=null;nukeFallGain=null;
  }
  function playNukeCrowd() {
    unlockSound();prepareNukeAudio();
    for(const audio of [nukeScreams,nukeCrowdLayer])if(audio){audio.loop=true;audio.play().catch(()=>{});}
  }
  function playNukeBoom() {
    stopNukeFallSound();unlockSound();prepareNukeAudio();
    for(const audio of [nukeScreams,nukeCrowdLayer])if(audio){audio.pause();audio.currentTime=0;}
    if(nukeBoom){nukeBoom.currentTime=0;nukeBoom.play().catch(()=>{});}
  }
  function stopNukeAudio() {
    stopNukeFallSound();
    for(const audio of [nukeMusic,nukeBoom,nukeScreams,nukeCrowdLayer])if(audio){audio.pause();audio.currentTime=0;}
  }
  window.addEventListener('pointerdown',unlockSound);
  window.addEventListener('keydown',unlockSound);
  function playOof(npc) {
    if(!effectsEnabled || !soundContext || soundContext.state!=='running')return;
    const distance=npc.group.position.distanceTo(position),volume=Math.max(0,1-distance/100);
    if(volume<=0)return;
    const now=soundContext.currentTime,voice=soundContext.createOscillator(),filter=soundContext.createBiquadFilter(),gain=soundContext.createGain();
    voice.type='sawtooth';voice.frequency.setValueAtTime(145,now);voice.frequency.exponentialRampToValueAtTime(78,now+.26);
    filter.type='lowpass';filter.frequency.setValueAtTime(650,now);filter.frequency.exponentialRampToValueAtTime(240,now+.27);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.12*volume,now+.035);gain.gain.exponentialRampToValueAtTime(.0001,now+.30);
    voice.connect(filter);filter.connect(gain);gain.connect(effectsBus);voice.start(now);voice.stop(now+.31);
  }
  function civilianCasualty(npc) {
    if(npc.dead)return;
    if(webGrab===npc)cancelWebGrab();
    clearWebPin(npc);releaseActorWeb(npc);cancelVisit(npc);cancelDonation(npc);
    npc.dead=true;npc.reviveAt=elapsed+10+Math.random()*6;npc.knockback=null;npc.group.rotation.x=Math.PI/2;npc.group.rotation.z=0;npc.top=.65;
    const p=npc.group.position;burst(p.clone().setY(p.y+.4),26,[0xffffff,0xd0c8bd,0xffd25e],{speed:7,up:4,life:.9,size:.5});impactFeedback(2);
    if(!nuke)awardChaos(250,pick(['WHOOPS','PANCAKED','THAT\'S GONNA LEAVE A MARK','GRAVITY: 1, YOU: 0']),p.clone().setY(p.y+1.6),'oops');
    npc.leftArm.rotation.x=.35;npc.rightArm.rotation.x=-.35;npc.leftLeg.rotation.x=.2;npc.rightLeg.rotation.x=-.2;
    playOof(npc);
  }
  function reset() {
    clearNuke();
    clearRescue();hideRescueNotice();rescueTimer=10;rescueSequence=0;
    speedBlurAmount=0;speedBlur.style.opacity='0';speedBlur.style.visibility='hidden';
    cancelWebGrab();
    for(const actor of [...cars,...pedestrians,rhino,...villains])if(actor.webPinned)clearWebPin(actor);
    resetBuildings();
    position.set(0,0,8); velocity.set(0,0,0); distance=0; elapsed=0; rope=null; showWeb(false); onGround=true;
    Object.keys(keys).forEach(k=>keys[k]=false);
    for(const car of cars) {if(car.beacon){car.speed=car.normalSpeed;car.beacon.visible=false;}car.stuck=false;car.webRemaining=0;car.webElapsed=0;car.roll=false;car.currentSpeed=car.speed;car.lateralSpeed=0;car.laneTarget=car.preferredLane;car.laneCooldown=0;car.group.rotation.z=0;car.group.position.y=0;car.waiting=null;car.passenger=null;}
    for(const npc of pedestrians) {
      cancelDonation(npc);npc.donationHistory?.clear();
      if(npc.cupCoins){for(const coin of npc.cupCoins)coin.removeFromParent();npc.cupCoins.length=0;}
      npc.dead=false;npc.reviveAt=0;npc.fearTimer=0;npc.panicFrom=null;npc.stuck=false;npc.webRemaining=0;npc.webPose=0;npc.top=npc.uprightTop;npc.visit=null;
      npc.leftArm.rotation.x=npc.rightArm.rotation.x=npc.leftLeg.rotation.x=npc.rightLeg.rotation.x=0;
      npc.group.visible=true;npc.group.rotation.x=0;npc.group.rotation.z=0;
      if(npc.settled)seatedRest(npc);if(npc.rooftopKind==='view')rooftopRest(npc);if(npc.wheelchair)restoreWheelchair(npc);
    }
    for(const shot of projectiles) scene.remove(shot.mesh); projectiles.length=0;
    for(const shot of enemyProjectiles)scene.remove(shot.mesh);enemyProjectiles.length=0;
    for(const effect of enemyEffects)scene.remove(effect.mesh);enemyEffects.length=0;
    for(const mark of splatters) disposeWeb(mark); splatters.length=0;
    for(const actor of [...cars,...pedestrians,...chargeProps,rhino,...villains])if(actor.knockback)recoverKnockback(actor);
    rhino.group.position.set(0,0,-29);rhino.group.rotation.set(0,0,0);rhino.body.rotation.set(0,0,0);rhino.state='roam';rhino.timer=0;rhino.webHits=0;rhino.stuck=false;rhino.webRemaining=0;rhino.hitActors.clear();playerImpact=0;
    for(const villain of villains){
      villain.group.position.copy(villain.spawn);villain.group.rotation.set(0,0,0);villain.body.rotation.set(0,0,0);villain.head.rotation.set(0,0,0);
      for(const joint of [...villain.arms,...villain.elbows,...villain.legs,...villain.knees])joint.rotation.set(0,0,0);
      if(villain.glider)villain.glider.rotation.set(0,0,0);
      villain.state='idle';villain.timer=0;villain.webHits=0;villain.stuck=false;villain.webRemaining=0;villain.attacks=0;
    }
    shockTime=0;attackImmunity=0;trickSpin=0;screenShake=0;hitStop=0;
    wallContact=null;wallRunTime=0;wallCooldown=0;zipTime=0;zipCooldown=0;zipAnchor=null;
    recentDanger=null;
    if(reticle)reticle.classList.remove('active','missed','hit');
    for(const boss of bosses){releaseActorWeb(boss.actor);boss.actor.stuck=false;boss.status='dormant';boss.timer=0;sleepBoss(boss);}alertTimer=25;focusBoss=null;updateVillainTracker();
    yaw=0; pitch=0; handBlend=0; swingPose=0; footPose=0; glideBlend=0;glideEngaged=false;glideWings.visible=false; cameraRoll=0; feedbackTime=0;runPhase=0;runBlend=0;bombAnimation=0;mapTimer=0; anchorMarker.visible=false; camera.fov=72;camera.updateProjectionMatrix();camera.position.set(0,1.7,8); camera.rotation.set(0,0,0,'YXZ');
  }
  function jump() {
    if (rope) {
      // Jumping off a web is a launch: up, forward, and a barrel roll at speed.
      const speed=Math.hypot(velocity.x,velocity.z),forward=speed>4?new THREE.Vector3(velocity.x/speed,0,velocity.z/speed):new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
      const fast=speed>22;rope.age=0;swing(false);playEffect('zip');
      velocity.y=Math.max(velocity.y,0)+11;velocity.addScaledVector(forward,7);onGround=false;
      if(fast){trickSpin=.0001;trickDirection=Math.random()<.5?-1:1;awardChaos(150,'WEB LAUNCH',null,'trick');}
    }
    else if (onGround) { playEffect('jump'); velocity.y=11; onGround=false; }
    else if(wallContact) {
      playEffect('jump');velocity.x=wallContact.x*12;velocity.z=wallContact.z*12;velocity.y=11;
      wallContact=null;wallCooldown=.35;onGround=false;
    }
  }
  // Attach where the pointer meets a high enough grapple surface; otherwise fan
  // rays ahead and above so a swing connects without pixel-perfect aim.
  function findAnchor(aimX,aimY) {
    raycaster.far=150;raycaster.setFromCamera(new THREE.Vector2(aimX,aimY),camera);
    const direct=raycaster.intersectObjects(grappleMeshes,false)[0];
    if(direct && direct.point.y>position.y+3)return direct;
    return assistAnchor(raycaster.ray.direction.clone()) || direct || null;
  }
  const assistUp=new THREE.Vector3(0,1,0),assistRay=new THREE.Vector3(),assistOrigin=new THREE.Vector3();let assistSide=1;
  function assistAnchor(aim) {
    const heading=new THREE.Vector3(aim.x,0,aim.z);
    if(heading.lengthSq()<1e-4)heading.set(-Math.sin(yaw),0,-Math.cos(yaw));
    heading.normalize();
    const travel=new THREE.Vector3(velocity.x,0,velocity.z);
    if(travel.lengthSq()>36)heading.lerp(travel.normalize(),.3).normalize();
    assistOrigin.set(position.x,position.y+1.5,position.z);
    let best=null,bestScore=-Infinity;
    for(const elevation of [.55,.8,1.05,1.3])for(const turn of [0,.32,-.32,.65,-.65]) {
      assistRay.copy(heading).applyAxisAngle(assistUp,turn).multiplyScalar(Math.cos(elevation));assistRay.y=Math.sin(elevation);
      raycaster.set(assistOrigin,assistRay.normalize());raycaster.far=95;
      const hit=raycaster.intersectObjects(grappleMeshes,false)[0];if(!hit)continue;
      const rise=hit.point.y-position.y,dx=hit.point.x-position.x,dz=hit.point.z-position.z;
      const ahead=dx*heading.x+dz*heading.z,lateral=dx*heading.z-dz*heading.x;
      if(rise<4 || ahead<1)continue;
      // Favor tall, forward anchors and alternate sides like hand-over-hand swinging.
      const score=Math.min(rise,38)+Math.min(ahead,45)*.75-Math.abs(lateral)*.12+(Math.sign(lateral)===assistSide?5:0)-Math.max(0,hit.distance-70)*.5;
      if(score>bestScore){bestScore=score;best=hit;}
    }
    raycaster.far=150;
    return best;
  }
  // A quick web zip pulls toward the surface at the center of the view.
  function webZip() {
    if(zipCooldown>0 || webGrab || nuke?.phase==='blast')return false;
    camera.updateMatrixWorld();scene.updateMatrixWorld(true);
    const hit=findAnchor(0,0);if(!hit){feedbackTime=1;return false;}
    if(rope)swing(false);
    const direction=hit.point.clone().sub(position.clone().add(new THREE.Vector3(0,1.3,0)));
    if(direction.lengthSq()<4)return false;
    playEffect('zip');direction.normalize();velocity.addScaledVector(direction,mutators.rocket?56:28);if(onGround)velocity.y=Math.max(velocity.y,4);
    onGround=false;zipAnchor=hit.point.clone();zipTime=.22;zipCooldown=.55;showWeb(true);flashReticle();return true;
  }
  function swing(start, aimX=0, aimY=0) {
    if (!start) {
      if(rope) {
        playEffect('release');
        // Letting go on the upswing slingshots; the ground does not count.
        if(rope.age>.35 && !onGround && velocity.y>-3) {
          velocity.multiplyScalar(mutators.rocket?1.45:1.1);velocity.y+=mutators.rocket?12:4.5;
          const speed=velocity.length();if(speed>28)awardChaos(Math.round(speed*2),'SLINGSHOT',null,'trick');
        }
      }
      keys.swing=false; rope=null; showWeb(false); anchorMarker.visible=false;if(reticle)reticle.classList.remove('active'); return;
    }
    if (keys.swing) return;
    if(zipTime>0)showWeb(false);zipTime=0;zipAnchor=null;keys.swing=true;
    camera.updateMatrixWorld();
    scene.updateMatrixWorld(true);
    const hit=findAnchor(aimX,aimY);
    if (!hit) {feedbackTime=1.3;return;}
    const anchor=hit.point.clone(),localAnchor=hit.object.worldToLocal(anchor.clone());
    const hand=position.clone().add(new THREE.Vector3(0,1.3,0));
    assistSide=Math.sign((anchor.x-position.x)*Math.cos(yaw)-(anchor.z-position.z)*Math.sin(yaw))||assistSide;
    playEffect('web');rope={anchor,anchorObject:hit.object,anchorInstance:hit.instanceId,localAnchor,anchorVelocity:new THREE.Vector3(),length:Math.max(2,hand.distanceTo(anchor)),age:0};showWeb(true);
    anchorMarker.position.copy(anchor);anchorMarker.visible=true;feedbackTime=0;
    if(reticle)reticle.classList.add('active');flashReticle();
    // The web pulls toward the hit point while preserving sideways swing momentum.
    if(onGround) { velocity.y=Math.max(velocity.y,8); velocity.addScaledVector(anchor.clone().sub(hand).normalize(),3); onGround=false; }
  }
  function handWorldPosition() {
    handsScene.updateMatrixWorld(true);handsCamera.updateMatrixWorld();camera.updateMatrixWorld();
    const fingertip=rightHand.localToWorld(rightHand.userData.fingertip.clone());
    const projected=fingertip.project(handsCamera);
    return new THREE.Vector3(projected.x,projected.y,.5).unproject(camera).sub(camera.position).normalize().multiplyScalar(1.4).add(camera.position);
  }
  function bombTargets() {
    return scene.children.filter(object=>object.visible && ((object.isMesh && object!==sky && !object.userData.projectile) || object.userData?.actor || object.userData?.targetable));
  }
  function staticWebSurfaces() {
    return scene.children.filter(object=>object.visible && ((object.isMesh && object!==sky && object!==anchorMarker && !object.userData.projectile) ||
      (object.userData.targetable && !object.userData.actor && !dogs.some(dog=>dog.group===object) && !helicopters.some(heli=>heli.group===object))));
  }
  function surfaceNormal(hit) {
    const matrix=hit.object.matrixWorld.clone();
    if(hit.object.isInstancedMesh && hit.instanceId!==undefined) {
      const instance=new THREE.Matrix4();hit.object.getMatrixAt(hit.instanceId,instance);matrix.multiply(instance);
    }
    return hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(matrix)).normalize();
  }
  function beginWebAction(aimX=0,aimY=0) {
    if(webGrab || rope || (nuke?.phase==='blast' && nuke.playerHit))return;
    if(zipTime>0){zipTime=0;zipAnchor=null;showWeb(false);}
    camera.updateMatrixWorld();scene.updateMatrixWorld(true);
    raycaster.far=150;raycaster.setFromCamera(new THREE.Vector2(aimX,aimY),camera);
    const hit=raycaster.intersectObjects(bombTargets(),true)[0];
    let owner=hit?.object;while(owner && !owner.userData.actor)owner=owner.parent;
    const actor=owner?.userData.actor;
    if(actor && !actor.dead && (cars.includes(actor)||pedestrians.includes(actor)||((actor===rhino||villains.includes(actor)) && actor.state==='subdued' && actor.stuck)) && actor.group.visible) {
      if(actor.knockback){const catchHeight=actor.group.position.y;recoverKnockback(actor);if(rescue?.type==='fall' && rescue.actor===actor)actor.group.position.y=catchHeight;}
      if(pedestrians.includes(actor)){cancelVisit(actor);cancelDonation(actor);}
      if(cars.includes(actor)&&actor.waiting){cancelVisit(actor.waiting);actor.waiting=null;}
      playEffect('web');actor.webHeld=true;webGrab=actor;showWeb(true);flashReticle();
    } else swing(true,aimX,aimY);
  }
  function cancelWebGrab() {
    if(!webGrab)return;
    webGrab.webHeld=false;webGrab=null;showWeb(false);
    if(reticle)reticle.classList.remove('active');
  }
  function endWebAction(aimX=0,aimY=0) {
    if(!webGrab){swing(false);return;}
    const actor=webGrab;cancelWebGrab();
    camera.rotation.set(pitch,yaw,cameraRoll,'YXZ');camera.updateMatrixWorld();scene.updateMatrixWorld(true);
    raycaster.far=150;raycaster.setFromCamera(new THREE.Vector2(aimX,aimY),camera);
    const hit=raycaster.intersectObjects(staticWebSurfaces(),true)[0];
    if(!hit || hit.point.x<worldMinX || hit.point.x>worldMaxX || hit.point.z<worldMinZ || hit.point.z>worldMaxZ || hit.distance>70) {
      // No surface to stick them to: yeet them where you are looking instead.
      const direction=raycaster.ray.direction.clone(),p=actor.group.position;
      if(actor!==rhino && !villains.includes(actor)) {
        throwActor(actor,direction,false,direction.multiplyScalar(cars.includes(actor)?30:42).add(new THREE.Vector3(0,9,0)));
        playEffect('zip',p);playVoice(p,'scream');impactFeedback(1.5);awardChaos(cars.includes(actor)?600:350,cars.includes(actor)?'CAR YEET':'YEET',p.clone().setY(p.y+2));
      } else feedbackTime=1.3;
      return;
    }
    const normal=surfaceNormal(hit);
    const destination=hit.point.clone(),isPerson=pedestrians.includes(actor)||actor===rhino||villains.includes(actor);
    if(normal.y>.5) {
      const wet=waterAt(destination.x,destination.z);
      if(wet && Math.abs(destination.y-wet.surface)<.3)destination.y=wet.floor;
      else destination.y+=isPerson?.05:.02;
    }
    else {
      destination.addScaledVector(normal,Math.abs(normal.x)*actor.hx+Math.abs(normal.z)*actor.hz+.12);
      destination.y=Math.max(isPerson?.05:.02,hit.point.y-actor.top*.5);
    }
    // Give elevated wall and ceiling attachments a short tether, but keep
    // objects resting on floors supported by the surface they were shot at.
    let hang=null;
    if(normal.y<.5) {
      const clearance=Math.abs(normal.x)*actor.hx+Math.abs(normal.z)*actor.hz+.8;
      const rest=hit.point.clone().addScaledVector(normal,clearance);
      raycaster.set(rest.clone().add(new THREE.Vector3(0,.2,0)),new THREE.Vector3(0,-1,0));raycaster.far=300;
      const support=raycaster.intersectObjects(staticWebSurfaces(),true)[0];
      const floor=support?support.point.y+(isPerson?.05:.02):(waterAt(rest.x,rest.z)?.floor??0);
      rest.y=Math.max(floor,hit.point.y-actor.top-1.1);
      if(rest.y>floor+.25) {
        const tangent=new THREE.Vector3(-normal.z,0,normal.x);
        if(tangent.lengthSq()<.01)tangent.set(1,0,0);else tangent.normalize();
        destination.copy(rest);hang={floor,tangent,age:0};
      }
    }
    playEffect('web');clearWebPin(actor);releaseActorWeb(actor);actor.stuck=true;actor.webRemaining=actor===rhino?18:isPerson?15:10;
    if(cars.includes(actor)){actor.currentSpeed=0;actor.lateralSpeed=0;actor.roll=false;}
    const wrap=wrapActor(actor.group,actor);if(actor===rhino)wrap.scale.set(2.6,2.2,2.5);else if(villains.includes(actor))wrap.scale.set(1.35,1.4,1.4);wrap.userData.webActor=actor;splatters.push(wrap);
    if(splatters.length>50)disposeWeb(splatters.shift());
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({length:9},()=>hit.point)),new THREE.LineBasicMaterial({color:0xf0ffff}));scene.add(line);
    if(actor===rhino||villains.includes(actor))damageBoss(actor,2,'PINNED TO THE WALL');
    actor.webPinned={from:actor.group.position.clone(),destination,anchor:hit.point.clone(),line,hang,elapsed:0,duration:Math.max(.35,Math.min(1.5,actor.group.position.distanceTo(destination)/35))};
    flashReticle();
  }
  function clearWebPin(actor) {
    if(!actor.webPinned)return;
    actor.webPinned.line.removeFromParent();actor.webPinned.line.geometry.dispose();actor.webPinned.line.material.dispose();actor.webPinned=null;
  }
  function updateWebPin(actor,dt) {
    const pin=actor.webPinned;if(!pin)return false;
    pin.elapsed+=dt;const t=Math.min(1,pin.elapsed/pin.duration),smooth=t*t*(3-2*t);
    actor.group.position.lerpVectors(pin.from,pin.destination,smooth);
    if(t<1)actor.group.position.y+=Math.sin(Math.PI*t)*Math.min(3,pin.from.distanceTo(pin.destination)*.12);
    if(t===1 && pin.hang) {
      const hang=pin.hang;hang.age+=dt;
      const sway=Math.sin(hang.age*2.2)*Math.exp(-hang.age*.32)*.9;
      actor.group.position.addScaledVector(hang.tangent,sway);
      actor.group.position.y=Math.max(hang.floor,pin.destination.y-.12*Math.abs(sway));
    }
    const coords=pin.line.geometry.attributes.position;
    const end=actor.group.position.clone().add(new THREE.Vector3(0,actor.top*.5,0));
    for(let i=0;i<coords.count;i++) {
      const u=i/(coords.count-1),sag=Math.sin(Math.PI*u)*(pin.hang?.12:.05);
      coords.setXYZ(i,end.x+(pin.anchor.x-end.x)*u,end.y+(pin.anchor.y-end.y)*u-sag,end.z+(pin.anchor.z-end.z)*u);
    }
    coords.needsUpdate=true;pin.line.geometry.computeBoundingSphere();
    if(t===1) {
      actor.webRemaining=Math.max(0,actor.webRemaining-dt);
      if(actor.webRemaining===0) {
        clearWebPin(actor);releaseActorWeb(actor);
        raycaster.set(actor.group.position.clone().add(new THREE.Vector3(0,.1,0)),new THREE.Vector3(0,-1,0));raycaster.far=300;
        const ground=raycaster.intersectObjects(staticWebSurfaces(),true)[0];
        const groundY=ground?ground.point.y+(pedestrians.includes(actor)?.05:.02):0;
        const villain=actor===rhino||villains.includes(actor);
        if(villain) {
          actor.webHits=0;actor.state=actor===rhino?'recover':'cooldown';actor.timer=2;
          actor.body.rotation.x=0;actor.body.rotation.z=0;
        }
        if(actor.group.position.y>groundY+.15)actor.knockback={ground:groundY,velocity:new THREE.Vector3(),spin:villain?0:2,time:0};
        else {actor.group.position.y=groundY;if(cars.includes(actor)){actor.roadX=Math.round(actor.group.position.x/40)*40;actor.preferredLane=actor.roadX+(actor.group.position.x>=actor.roadX?2:-2);actor.laneTarget=actor.preferredLane;}else if(pedestrians.includes(actor) && !actor.settled)nearestRouteCorner(actor);}
      }
    }
    return true;
  }
  const bombMat=new THREE.MeshStandardMaterial({color:0xe9fcff,emissive:0x7ebcc9,emissiveIntensity:.7,roughness:.4});
  const bombGeo=new THREE.SphereGeometry(.13,12,8);
  const webMaterial=new THREE.MeshStandardMaterial({color:0xeaf8f6,roughness:.48,metalness:.04});
  function fireBomb(aimX=0,aimY=0) {
    playEffect('bomb');bombAnimation=.38;
    camera.position.set(position.x,position.y+1.7,position.z);camera.rotation.set(pitch,yaw,0,'YXZ');camera.updateMatrixWorld();
    scene.updateMatrixWorld(true);raycaster.far=150;raycaster.setFromCamera(new THREE.Vector2(aimX,aimY),camera);
    const hit=raycaster.intersectObjects(bombTargets(),true)[0];
    const aimPoint=hit?hit.point.clone():raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction,150);
    const mesh=new THREE.Mesh(bombGeo,bombMat);mesh.userData.projectile=true;mesh.position.copy(handWorldPosition());scene.add(mesh);
    projectiles.push({mesh,direction:aimPoint.sub(mesh.position).normalize(),life:2.5});
  }
  function disposeWeb(mark) {
    mark.removeFromParent();mark.traverse(child=>{if(child.isMesh)child.geometry.dispose();});
  }
  function strand(group,points,radius=.012,closed=false) {
    const curve=new THREE.CatmullRomCurve3(points,closed,'centripetal');
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(16,points.length*3),radius,5,closed),webMaterial);
    group.add(mesh);
  }
  const rubbleGeometry=new THREE.BoxGeometry(1,1,1),rubbleTransform=new THREE.Object3D();
  function structureForHit(hit) {
    if(hit.object.isInstancedMesh && hit.instanceId!==undefined) {
      const owner=hit.object.userData.structures?.[hit.instanceId];if(owner)return owner;
    }
    let object=hit.object;while(object){if(object.userData.structure)return object.userData.structure;object=object.parent;}
    return null;
  }
  function damageBuilding(building,amount,skipRubble=false) {
    if(!building || building.destroyed)return;
    building.hits+=amount;if(building.hits<5)return;
    if(!skipRubble)playEffect('collapse',{x:building.x,y:0,z:building.z});
    building.destroyed=true;building.grappleParts=[];
    for(const part of building.parts) {
      if(part.parent)part.visible=false;
      part.traverse(child=>{const i=grappleMeshes.indexOf(child);if(i>=0){building.grappleParts.push(child);grappleMeshes.splice(i,1);}});
    }
    const hidden=new THREE.Matrix4().makeTranslation(0,-10000,0);
    for(const part of building.instanceParts){part.batch.setMatrixAt(part.index,hidden);part.batch.instanceMatrix.needsUpdate=true;}
    for(let i=splatters.length-1;i>=0;i--)if(splatters[i].userData.webStructure===building){disposeWeb(splatters[i]);splatters.splice(i,1);}
    if(rope && (building.grappleParts.includes(rope.anchorObject) || (rope.anchorObject.userData.structures && rope.anchorObject.userData.structures[rope.anchorInstance]===building)))swing(false);
    building.rooftopOccupants=[];
    for(const washer of building.washers||[]) {
      const worker=washer.worker;
      if(worker.rooftop && !worker.dead) {
        building.rooftopOccupants.push({npc:worker,position:worker.group.position.clone(),yaw:worker.group.rotation.y});
        worker.rooftop=false;worker.settled=false;
        if(!worker.webHeld && !worker.webPinned) {
          if(worker.knockback)recoverKnockback(worker);
          throwActor(worker,new THREE.Vector3(0,0,1),true);
          if(worker.knockback){worker.knockback.velocity.set(0,0,0);worker.knockback.ground=waterAt(worker.group.position.x,worker.group.position.z)?.floor??.12;}
        }
      }
      startWasherFall(washer);
    }
    for(const npc of pedestrians)if(npc.rooftop && Math.abs(npc.group.position.x-building.x)<building.w/2+2 && Math.abs(npc.group.position.z-building.z)<building.d/2+2 && npc.group.position.y>=building.height-3) {
      building.rooftopOccupants.push({npc,position:npc.group.position.clone(),yaw:npc.group.rotation.y});
      if(npc.webPinned)clearWebPin(npc);if(npc.stuck)releaseActorWeb(npc);
      npc.rooftop=false;npc.settled=false;throwActor(npc,new THREE.Vector3(0,0,1),true);
      if(npc.knockback)npc.knockback.ground=.45;
    }
    if(skipRubble)return;
    const mesh=new THREE.InstancedMesh(rubbleGeometry,stone,16),pieces=[];mesh.castShadow=true;scene.add(mesh);
    for(let i=0;i<16;i++) {
      const seed=building.x*13+building.z*7+i*31,size=1+random(seed)*2.2;
      pieces.push({position:new THREE.Vector3(building.x+(random(seed+1)-.5)*building.w*.7,1+random(seed+2)*Math.min(building.height,24),building.z+(random(seed+3)-.5)*building.d*.7),
        velocity:new THREE.Vector3((random(seed+4)-.5)*8,2+random(seed+5)*5,(random(seed+6)-.5)*8),size,angle:random(seed+7)*Math.PI,spin:(random(seed+8)-.5)*5});
    }
    building.rubble={mesh,pieces,active:true};updateRubble(0);
  }
  function updateRubble(dt) {
    for(const building of destructibleBuildings) {
      const rubble=building.rubble;if(!rubble || !rubble.active)continue;
      let moving=false;
      rubble.pieces.forEach((piece,i)=>{
        const wet=waterAt(piece.position.x,piece.position.z),floor=(wet?.floor??0)+piece.size*.5;
        if(piece.position.y>floor || piece.velocity.y>0) {
          moving=true;piece.velocity.y-=22*dt;piece.position.addScaledVector(piece.velocity,dt);piece.angle+=piece.spin*dt;
          if(wet && piece.position.y<wet.surface){piece.velocity.x*=Math.exp(-2.5*dt);piece.velocity.z*=Math.exp(-2.5*dt);}
          if(piece.position.y<floor){piece.position.y=floor;piece.velocity.set(0,0,0);}
        }
        rubbleTransform.position.copy(piece.position);rubbleTransform.rotation.set(piece.angle*.5,piece.angle,piece.angle*.3);rubbleTransform.scale.set(piece.size,piece.size*.6,piece.size*.8);rubbleTransform.updateMatrix();rubble.mesh.setMatrixAt(i,rubbleTransform.matrix);
      });
      rubble.mesh.instanceMatrix.needsUpdate=true;rubble.mesh.computeBoundingSphere();rubble.active=moving;
    }
  }
  function startWasherFall(washer) {
    if(washer.fall)return;
    for(const cable of washer.cables)cable.removeFromParent();
    const lines=washer.cables.map(()=>{
      const geometry=new THREE.BufferGeometry().setFromPoints(Array.from({length:81},()=>new THREE.Vector3()));
      const line=new THREE.Line(geometry,fallenCableMaterial);line.frustumCulled=false;scene.add(line);return line;
    });
    const wet=waterAt(washer.origin.x,washer.origin.z);
    washer.fall={time:0,speed:0,floor:wet?wet.floor+.12:.12,coil:0,lines,complete:false};
    updateWasher(washer,0);
  }
  function updateWasher(washer,dt) {
    const fall=washer.fall;if(!fall || fall.complete)return;
    fall.time+=dt;fall.speed+=22*dt;
    washer.platform.position.y=Math.max(fall.floor,washer.platform.position.y-fall.speed*dt);
    const upper=Math.max(fall.floor,washer.roof-11*fall.time*fall.time);
    if(upper<=fall.floor+.02 && washer.platform.position.y<=fall.floor+.02)fall.coil=Math.min(1,fall.coil+dt*2);
    for(let sideIndex=0;sideIndex<2;sideIndex++) {
      const side=sideIndex===0?-1:1,coords=fall.lines[sideIndex].geometry.attributes.position;
      for(let i=0;i<=80;i++) {
        const t=i/80,angle=t*Math.PI*8*side,radius=.04+t*.55;
        const x=washer.platform.position.x+side*1.4+Math.cos(angle)*radius*fall.coil;
        const z=washer.platform.position.z+Math.sin(angle)*radius*fall.coil;
        const straight=washer.platform.position.y+(upper-washer.platform.position.y)*t;
        coords.setXYZ(i,x,THREE.MathUtils.lerp(straight,fall.floor+.04,fall.coil),z);
      }
      coords.needsUpdate=true;
    }
    fall.complete=fall.coil>=1;
  }
  function resetWasher(washer) {
    if(!washer.fall)return;
    for(const line of washer.fall.lines){line.removeFromParent();line.geometry.dispose();}
    washer.platform.position.copy(washer.origin);washer.platform.rotation.set(0,0,0);
    for(const cable of washer.cables)washer.platform.add(cable);
    washer.fall=null;
  }
  function resetBuildings() {
    for(const building of destructibleBuildings) {
      building.hits=0;
      if(!building.destroyed)continue;
      building.destroyed=false;
      for(const washer of building.washers||[])resetWasher(washer);
      for(const part of building.parts)if(part.parent && !part.userData.modelReplaced)part.visible=true;
      for(const part of building.instanceParts){part.batch.setMatrixAt(part.index,part.matrix);part.batch.instanceMatrix.needsUpdate=true;}
      for(const mesh of building.grappleParts)grappleMeshes.push(mesh);
      for(const saved of building.rooftopOccupants||[]){saved.npc.knockback=null;saved.npc.rooftop=true;saved.npc.settled=true;saved.npc.group.position.copy(saved.position);saved.npc.group.rotation.y=saved.yaw;}
      building.rooftopOccupants=[];
      if(building.rubble){building.rubble.mesh.removeFromParent();building.rubble.mesh.dispose();building.rubble=null;}
    }
  }
  function clearNuke() {
    stopNukeAudio();
    if(nuke) {
      for(const tree of nuke.trees||[]){tree.group.position.copy(tree.origin);tree.group.quaternion.copy(tree.rotation);}
      for(const item of nuke.specials||[])if(item.dog||item.aircraft){item.group.position.copy(item.origin);item.group.quaternion.copy(item.rotation);if(item.dog)item.dog.leash.visible=true;}
      for(const saved of nuke.actorOrigins||[]){saved.actor.group.position.copy(saved.position);saved.actor.group.quaternion.copy(saved.rotation);}
      for(const flight of nuke.distantFlights||[]) {
        const b=flight.building;b.tower.setMatrixAt(b.towerIndex,b.towerMatrix);b.roof.setMatrixAt(b.roofIndex,b.roofMatrix);
        b.tower.instanceMatrix.needsUpdate=true;b.roof.instanceMatrix.needsUpdate=true;
      }
      for(const [batch,culling] of nuke.distantBatches||[])batch.frustumCulled=culling;
      nuke.group.removeFromParent();
      nuke.group.traverse(part=>{if(part.isMesh&&!part.userData.nukeShared){part.geometry.dispose();part.material.dispose();}else if(part.isSprite)part.material.dispose();});
      nuke.smokeTexture?.dispose();
      nuke=null;
    }
    if(nukeRubble){nukeRubble.removeFromParent();nukeRubble.dispose();nukeRubble=null;}
    blastFlash.style.opacity='0';blastWind.style.opacity='0';blastBlackout.style.opacity='0';blackout=0;blackoutMode='';nukeButton.disabled=false;
  }
  function launchNuke() {
    if(nuke)return;
    if(!nukeUnlocked){showBreaking(`☢ NUKE LOCKED: BEAT ${bosses.length-villainsBeaten.size} MORE VILLAINS OR CAUSE 250,000 CHAOS`);playEffect('failure');return false;}
    // The crosshair targets the nearest visible world surface, including roofs and water.
    camera.rotation.set(pitch,yaw,cameraRoll,'YXZ');camera.updateMatrixWorld();scene.updateMatrixWorld(true);
    raycaster.far=camera.far;raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
    const hit=raycaster.intersectObjects(staticWebSurfaces(),true)[0];
    if(!hit){feedbackTime=1.3;return false;}
    const target=hit.point.clone();
    const group=new THREE.Group(),missile=new THREE.Group();scene.add(group);group.add(missile);
    const metal=new THREE.MeshStandardMaterial({color:0x69777a,metalness:.65,roughness:.35}),tipMat=new THREE.MeshStandardMaterial({color:0xa12c21,roughness:.6});
    const body=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,7,12),metal);missile.add(body);
    const nose=new THREE.Mesh(new THREE.ConeGeometry(1.1,2.4,12),tipMat);nose.position.y=-4.7;nose.rotation.z=Math.PI;missile.add(nose);
    for(const side of [-1,1]){const fin=box(2.2,1.7,.12,tipMat,side*1.15,2.3,0,missile);fin.rotation.z=side*.25;}
    missile.position.copy(target);missile.position.y=target.y+700;missile.visible=false;
    const actorOrigins=[...cars,...pedestrians,...chargeProps].map(actor=>({actor,position:actor.group.position.clone(),rotation:actor.group.quaternion.clone()}));
    nuke={group,missile,target,time:0,phase:'warning',hitActors:new Set(),hitTrees:new Set(),hitDogs:new Set(),hitAircraft:new Set(),hitDistant:new Set(),distantFlights:[],distantBatches:new Map(),trees:[],flights:[],specials:[],fallingBuildings:[],debris:[],actorOrigins,playerHit:false};nukeButton.disabled=true;playNukeMusic();
  }
  function detonateNuke() {
    playNukeBoom();awardChaos(1000000,'WAR CRIMES',null,'oops');adjustOpinion(-100);
    nuke.phase='blast';nuke.time=0;nuke.missile.visible=false;scene.updateMatrixWorld(true);
    const cloud=new THREE.Group();cloud.position.copy(nuke.target);nuke.group.add(cloud);nuke.cloud=cloud;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(64,64,5,64,64,62);
    gradient.addColorStop(0,'rgba(255,255,255,.95)');gradient.addColorStop(.45,'rgba(255,255,255,.65)');gradient.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);nuke.smokeTexture=new THREE.CanvasTexture(canvas);
    nuke.cloudPuffs=[];
    for(let i=0;i<44;i++) {
      const cap=i>=18,angle=i*2.399,radial=cap?12+(i%5)*6:(i%3)*3;
      const material=new THREE.SpriteMaterial({map:nuke.smokeTexture,color:i<7?0xffb04f:cap?0x9b8e80:0x5d514c,transparent:true,opacity:i<7?.8:.55,depthWrite:false});
      const puff=new THREE.Sprite(material),size=cap?38+(i%4)*8:26+(i%4)*5;
      puff.position.set(Math.cos(angle)*radial,cap?65+(i%4)*7:5+i*3.6,Math.sin(angle)*radial);
      puff.scale.set(size,size,1);cloud.add(puff);nuke.cloudPuffs.push({puff,size,cap,angle});
    }
    const wave=new THREE.Mesh(new THREE.RingGeometry(.96,1,80),new THREE.MeshBasicMaterial({color:0xffd897,transparent:true,opacity:.75,side:THREE.DoubleSide,depthWrite:false}));
    wave.rotation.x=-Math.PI/2;wave.position.set(nuke.target.x,nuke.target.y+.2,nuke.target.z);nuke.group.add(wave);nuke.wave=wave;
    if(nukeRubble){nukeRubble.removeFromParent();nukeRubble.dispose();}
    nukeRubble=new THREE.InstancedMesh(rubbleGeometry,stone,destructibleBuildings.length*2);nukeRubble.count=0;nukeRubble.frustumCulled=false;scene.add(nukeRubble);
  }
  function blastVelocity(point,seed) {
    const dx=point.x-nuke.target.x,dz=point.z-nuke.target.z;
    const angle=Math.atan2(dz,dx)+(random(seed+71)-.5)*1.4;
    const horizontal=130+random(seed+73)*130;
    return new THREE.Vector3(Math.cos(angle)*horizontal,55+random(seed+79)*120,Math.sin(angle)*horizontal);
  }
  function startFallingBuilding(building) {
    let source=null,matrix=null;
    if(building.suburb && building.instanceParts.length===1) {
      const part=building.instanceParts[0];source=part.batch;
      const instance=new THREE.Matrix4();source.getMatrixAt(part.index,instance);matrix=source.matrixWorld.clone().multiply(instance);
    }
    if(!source) {
      source=building.parts.find(part=>part.isMesh && part.parent && grappleMeshes.includes(part));
      if(source){source.updateWorldMatrix(true,false);matrix=source.matrixWorld.clone();}
    }
    if(!source || !matrix)return;
    const pivot=new THREE.Group(),visual=new THREE.Mesh(source.geometry,source.material);
    visual.userData.nukeShared=true;visual.matrixAutoUpdate=false;
    visual.matrix.copy(new THREE.Matrix4().makeTranslation(-building.x,0,-building.z).multiply(matrix));
    pivot.position.set(building.x,0,building.z);pivot.add(visual);nuke.group.add(pivot);
    const direction=new THREE.Vector3(building.x-nuke.target.x,0,building.z-nuke.target.z);
    if(direction.lengthSq()<.01)direction.set(0,0,1);direction.normalize();
    const seed=building.x*13+building.z*7;
    nuke.fallingBuildings.push({pivot,axis:new THREE.Vector3(direction.z,0,-direction.x),velocity:blastVelocity(pivot.position,seed),spin:(random(seed+83)-.5)*2.4,age:0});
  }
  function updateNuke(dt) {
    if(!nuke)return;
    nuke.time+=dt;
    if(nuke.phase==='warning') {
      if(nuke.time>=4){nuke.phase='fall';nuke.time=0;nuke.missile.visible=true;startNukeFallSound();playNukeCrowd();}
      return;
    }
    if(nuke.phase==='fall') {
      const t=Math.min(1,nuke.time/8);nuke.missile.position.y=nuke.target.y+700-694.1*t*t;
      nuke.missile.rotation.y+=dt*2;updateNukeFallSound(t);
      if(t===1)detonateNuke();
      return;
    }
    const radius=Math.min(1700,nuke.time*300),wave=nuke.wave;
    wave.scale.setScalar(Math.max(1,radius));wave.material.opacity=Math.max(0,.7-nuke.time*.16);
    nuke.cloud.scale.setScalar(Math.min(2.4,.4+nuke.time*.35));
    nuke.cloud.position.y=nuke.target.y+Math.min(25,nuke.time*4);
    for(const item of nuke.cloudPuffs) {
      const pulse=1+.08*Math.sin(nuke.time*2+item.angle);
      item.puff.scale.set(item.size*pulse,item.size*pulse,1);
      item.puff.material.opacity=Math.max(0,(item.cap?.55:.65)*Math.min(1,nuke.time*2));
    }
    blastFlash.style.opacity=String(Math.max(0,.8-nuke.time*1.2));
    blastWind.style.opacity=String(Math.max(0,Math.min(.8,nuke.time*2,5.8-nuke.time)));
    for(const building of distantBuildings) {
      if(nuke.hitDistant.has(building) || Math.hypot(building.x-nuke.target.x,building.z-nuke.target.z)>radius)continue;
      nuke.hitDistant.add(building);
      const pos=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();building.towerMatrix.decompose(pos,rotation,scale);
      const roofPos=new THREE.Vector3(),roofRotation=new THREE.Quaternion(),roofScale=new THREE.Vector3();building.roofMatrix.decompose(roofPos,roofRotation,roofScale);
      for(const batch of [building.tower,building.roof])if(!nuke.distantBatches.has(batch)){nuke.distantBatches.set(batch,batch.frustumCulled);batch.frustumCulled=false;}
      const axis=new THREE.Vector3(random(building.seed+9)-.5,random(building.seed+10)-.5,random(building.seed+11)-.5).normalize();
      nuke.distantFlights.push({building,pos,scale,roofScale,roofOffset:roofPos.sub(pos),velocity:blastVelocity(pos,building.seed),axis,spin:(random(building.seed+12)-.5)*2,age:0});
    }
    for(const flight of nuke.distantFlights) {
      flight.age+=dt;flight.velocity.y-=12*dt;flight.pos.addScaledVector(flight.velocity,dt);
      const rotation=new THREE.Quaternion().setFromAxisAngle(flight.axis,flight.age*flight.spin),matrix=new THREE.Matrix4();
      matrix.compose(flight.pos,rotation,flight.scale);flight.building.tower.setMatrixAt(flight.building.towerIndex,matrix);
      const roofPos=flight.roofOffset.clone().applyQuaternion(rotation).add(flight.pos);
      matrix.compose(roofPos,rotation,flight.roofScale);flight.building.roof.setMatrixAt(flight.building.roofIndex,matrix);
      flight.building.tower.instanceMatrix.needsUpdate=true;flight.building.roof.instanceMatrix.needsUpdate=true;
    }
    for(const building of destructibleBuildings) {
      if(building.destroyed || Math.hypot(building.x-nuke.target.x,building.z-nuke.target.z)>radius)continue;
      startFallingBuilding(building);damageBuilding(building,5,true);
      for(let i=0;i<2;i++) {
        const seed=building.x*17+building.z*13+i*19,size=Math.max(1,Math.min(6,building.w*.16));
        const origin=new THREE.Vector3(building.x+(random(seed)-.5)*building.w*.5,Math.min(15,building.height*.45),building.z+(random(seed+1)-.5)*building.d*.5);
        nuke.debris.push({position:origin,velocity:blastVelocity(origin,seed+400),size,angle:random(seed+2)*Math.PI,spin:1+random(seed+5)*3});
        nukeRubble.count++;
      }
      nukeRubble.instanceMatrix.needsUpdate=true;
    }
    for(const falling of nuke.fallingBuildings) {
      falling.age+=dt;const t=Math.min(1,falling.age/.85),angle=t*t*(3-2*t)*Math.PI*.52;
      falling.pivot.quaternion.setFromAxisAngle(falling.axis,angle);
      falling.pivot.rotateY(falling.age*falling.spin);
      falling.velocity.y-=12*dt;falling.pivot.position.addScaledVector(falling.velocity,dt);
    }
    for(const actor of [...cars,...pedestrians,...chargeProps]) {
      if(nuke.hitActors.has(actor) || Math.hypot(actor.group.position.x-nuke.target.x,actor.group.position.z-nuke.target.z)>radius)continue;
      nuke.hitActors.add(actor);
      const direction=actor.group.position.clone().sub(nuke.target);direction.y=0;if(direction.lengthSq()<.01)direction.set(0,0,1);
      if(webGrab===actor)cancelWebGrab();else actor.webHeld=false;
      if(actor.webPinned)clearWebPin(actor);if(actor.stuck)releaseActorWeb(actor);if(actor.knockback)recoverKnockback(actor);
      throwActor(actor,direction.normalize(),false);
      if(actor.knockback){actor.knockback.velocity.copy(blastVelocity(actor.group.position,actor.seed*3+211));nuke.flights.push(actor);}
    }
    for(const group of scene.children) {
      if(!group.userData.treeType || nuke.hitTrees.has(group) || Math.hypot(group.position.x-nuke.target.x,group.position.z-nuke.target.z)>radius)continue;
      nuke.hitTrees.add(group);
      const seed=group.position.x*17+group.position.z*11;
      nuke.trees.push({group,origin:group.position.clone(),rotation:group.quaternion.clone(),velocity:blastVelocity(group.position,seed),spin:(random(seed+3)-.5)*3,spinX:(random(seed+5)-.5)*2});
    }
    for(const dog of dogs) {
      if(nuke.hitDogs.has(dog) || !dog.group.visible || Math.hypot(dog.group.position.x-nuke.target.x,dog.group.position.z-nuke.target.z)>radius)continue;
      nuke.hitDogs.add(dog);dog.leash.visible=false;
      const seed=dog.group.position.x*23+dog.group.position.z*17;
      nuke.specials.push({group:dog.group,dog,origin:dog.group.position.clone(),rotation:dog.group.quaternion.clone(),velocity:blastVelocity(dog.group.position,seed),spin:.8+random(seed+3)*2});
    }
    for(const aircraft of highAircraft) {
      if(nuke.hitAircraft.has(aircraft) || aircraft.group.position.distanceTo(nuke.target)>radius)continue;
      nuke.hitAircraft.add(aircraft);
      const group=aircraft.group,seed=aircraft.phase*101+aircraft.height;
      nuke.specials.push({group,aircraft,origin:group.position.clone(),rotation:group.quaternion.clone(),velocity:blastVelocity(group.position,seed),spin:.4+random(seed+3)*1.2});
    }
    for(const actor of [rhino,...villains]) {
      if(nuke.hitActors.has(actor) || Math.hypot(actor.group.position.x-nuke.target.x,actor.group.position.z-nuke.target.z)>radius)continue;
      nuke.hitActors.add(actor);
      if(webGrab===actor)cancelWebGrab();else actor.webHeld=false;
      if(actor.webPinned)clearWebPin(actor);if(actor.stuck)releaseActorWeb(actor);if(actor.knockback)recoverKnockback(actor);
      const seed=actor.group.position.x*23+actor.group.position.z*17;
      nuke.specials.push({group:actor.group,velocity:blastVelocity(actor.group.position,seed),spin:.8+random(seed+3)*2});
    }
    for(const actor of nuke.flights){const flight=actor.knockback;if(flight){flight.velocity.y-=12*dt;actor.group.position.addScaledVector(flight.velocity,dt);actor.group.rotation.z+=flight.spin*dt;}}
    for(const actor of nuke.specials){actor.velocity.y-=12*dt;actor.group.position.addScaledVector(actor.velocity,dt);actor.group.rotation.z+=dt*actor.spin;}
    for(const tree of nuke.trees){tree.velocity.y-=12*dt;tree.group.position.addScaledVector(tree.velocity,dt);tree.group.rotation.z+=tree.spin*dt;tree.group.rotation.x+=tree.spinX*dt;}
    nuke.debris.forEach((piece,i)=>{
      piece.velocity.y-=12*dt;piece.position.addScaledVector(piece.velocity,dt);piece.angle+=piece.spin*dt;
      rubbleTransform.position.copy(piece.position);rubbleTransform.rotation.set(piece.angle*.5,piece.angle,piece.angle*.3);rubbleTransform.scale.set(piece.size,piece.size*.6,piece.size*.8);rubbleTransform.updateMatrix();nukeRubble.setMatrixAt(i,rubbleTransform.matrix);
    });
    if(nuke.debris.length)nukeRubble.instanceMatrix.needsUpdate=true;
    if(!nuke.playerHit) {
      // The blast always reaches the player and throws them away from its impact.
      nuke.playerHit=true;cancelWebGrab();swing(false);
      const direction=new THREE.Vector3(position.x-nuke.target.x,0,position.z-nuke.target.z);
      if(direction.lengthSq()<.01)direction.set(Math.sin(yaw),0,Math.cos(yaw));
      direction.normalize();velocity.set(direction.x*210,110,direction.z*210);
      position.y=Math.max(position.y,.2);onGround=false;playerImpact=1.4;
    }
    if(nuke.time>5.5) {
      blackout=Math.min(1,(nuke.time-5.5)/1.5);blastBlackout.style.opacity=String(blackout);
    }
    if(nuke.time>=7.2) {
      reset();blackout=1;blackoutMode='out';blastBlackout.style.opacity='1';
    }
  }
  function wrapActor(owner,actor) {
    const wrap=new THREE.Group();owner.add(wrap);
    const isCar=cars.includes(actor);
    for(let band=0;band<3;band++) {
      const points=[];
      for(let i=0;i<=50;i++) {
        const t=i/50, angle=(band===1?-1:1)*t*Math.PI*6+band*Math.PI*2/3;
        if(isCar) points.push(new THREE.Vector3(Math.cos(angle)*(actor.hx+.08),actor.top*.52+Math.sin(angle)*actor.top*.52,-actor.hz+2*actor.hz*t));
        else points.push(new THREE.Vector3(Math.cos(angle)*.43,.35+1.48*t,Math.sin(angle)*.28));
      }
      strand(wrap,points,.018);
    }
    for(let ring=0;ring<3;ring++) {
      const points=[];
      for(let i=0;i<24;i++) {
        const a=i*Math.PI*2/24;
        if(isCar) points.push(new THREE.Vector3(Math.cos(a)*(actor.hx+.10),actor.top*.52+Math.sin(a)*actor.top*.52,(ring-1)*actor.hz*.5));
        else points.push(new THREE.Vector3(Math.cos(a)*.44,.65+ring*.43,Math.sin(a)*.30));
      }
      strand(wrap,points,.015,true);
    }
    return wrap;
  }
  function splatter(hit) {
    const structure=structureForHit(hit);
    if(structure){damageBuilding(structure,1);if(structure.destroyed)return;}
    let owner=hit.object;
    while(owner && !owner.userData.actor) owner=owner.parent;
    let mark;
    if(owner && owner.userData.actor) {
      const actor=owner.userData.actor,wasWebbed=actor.stuck;if(actor.dead)return;mark=wrapActor(owner,actor);mark.userData.webActor=actor;
      if(actor===rhino || villains.includes(actor)) {
        if(actor===rhino)mark.scale.set(2.6,2.2,2.5);else mark.scale.set(1.35,1.4,1.4);
        damageBoss(actor,1,'WEB SHOT',hit.point);
        if(actor.boss?.status==='active' && actor.state!=='subdued' && actor.state!=='charge' && actor.state!=='windup' && actor.state!=='dive'){actor.state='stagger';actor.timer=.25;}
      }
      else if(pedestrians.includes(actor)) {if(!wasWebbed){awardChaos(80,'GIFT WRAPPED',hit.point);say(actor,'webbed',.6);}actor.stuck=true;cancelVisit(actor);cancelDonation(actor);actor.webRemaining=15;}
      else if(cars.includes(actor)) {
        actor.stuck=true;
        actor.webRemaining=10;
        if(!wasWebbed) {actor.webElapsed=0;actor.roll=actor.currentSpeed>2 && random(actor.seed*7+Math.floor(elapsed*5))>.72;}
      }
    } else {
      // The impact patch has depth: strands arc from a raised center to the surface.
      const normal=surfaceNormal(hit);
      mark=new THREE.Group();mark.position.copy(hit.point).addScaledVector(normal,.035);
      mark.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);scene.add(mark);
      for(let i=0;i<12;i++) {
        const angle=i*Math.PI/6,radius=.7*(.7+random(i*11+elapsed)*.5);
        strand(mark,[new THREE.Vector3(0,0,.12),new THREE.Vector3(Math.cos(angle)*radius*.5,Math.sin(angle)*radius*.5,.1),new THREE.Vector3(Math.cos(angle)*radius,Math.sin(angle)*radius,.02)],.012);
      }
      for(let ring=1;ring<=3;ring++) {
        const points=[],radius=.17*ring;
        for(let i=0;i<24;i++){const a=i*Math.PI*2/24;points.push(new THREE.Vector3(Math.cos(a)*radius,Math.sin(a)*radius,.06));}
        strand(mark,points,.01,true);
      }
      hit.object.attach(mark);
    }
    if(structure)mark.userData.webStructure=structure;
    splatters.push(mark);
    if(splatters.length>50) disposeWeb(splatters.shift());
  }
  function overlaps(x,z,hx,hz,other) {
    return Math.abs(x-other.group.position.x)<hx+other.hx && Math.abs(z-other.group.position.z)<hz+other.hz;
  }
  function actorFloor(actor) {return actor.webPinned || actor.rooftop || (waterAt(actor.group.position.x,actor.group.position.z) && actor.group.position.y<0)?actor.group.position.y:0;}
  function actorBlocked(actor,oldX,oldZ,others) {
    const p=actor.group.position;
    for (const other of others) {
      if(other===actor || other.dead || !other.group.visible) continue;
      if(!overlaps(p.x,p.z,actor.hx,actor.hz,other))continue;
      if(actorFloor(actor)+actor.top<=actorFloor(other) || actorFloor(other)+other.top<=actorFloor(actor))continue;
      if(!overlaps(oldX,oldZ,actor.hx,actor.hz,other)) return true;
    }
    const base=actorFloor(actor);
    if(position.y<base+actor.top && position.y+1.8>base) {
      const player={group:{position},hx:.38,hz:.38};
      if(overlaps(p.x,p.z,actor.hx,actor.hz,player) && !overlaps(oldX,oldZ,actor.hx,actor.hz,player)) return true;
    }
    return false;
  }
  function resolvePlayerActors() {
    for(const actor of [...cars,...pedestrians]) {
      const p=actor.group.position;
      const base=actorFloor(actor),top=base+actor.top;
      if(actor.dead || !actor.group.visible || !overlaps(position.x,position.z,.38,.38,actor) || position.y>=top || position.y+1.8<=base) continue;
      const person=pedestrians.includes(actor),horizontal=Math.hypot(velocity.x,velocity.z);
      if(person && !actor.knockback && !actor.webHeld && !actor.webPinned && previous.y>=top-.3 && velocity.y<-8) {
        // Landing on someone from height is a stomp: they go flying, you bounce.
        const away=new THREE.Vector3(p.x-position.x,0,p.z-position.z);if(away.lengthSq()<.01)away.set(Math.random()-.5,0,Math.random()-.5);away.normalize();
        throwActor(actor,away,false,away.multiplyScalar(9).add(new THREE.Vector3(0,6+Math.min(12,-velocity.y*.4),0)));
        velocity.y=13;onGround=false;playVoice(p,'grunt');playEffect('impact',p);impactFeedback(2.5);
        burst(p.clone().setY(top),18,[0xfff2a8,0xffffff],{speed:8,up:2,life:.4,size:.3});awardChaos(300,'GOOMBA STOMP',p.clone().setY(top+1));say(actor,'hit',.6);continue;
      }
      if(previous.y>=top && velocity.y<=0) {position.y=top;velocity.y=0;onGround=true;continue;}
      const fast=person?horizontal>7.5 || (!onGround && velocity.length()>10):cars.includes(actor) && horizontal>28;
      if(fast && !actor.knockback && !actor.webHeld && !actor.webPinned) {
        // Goat rules: anything you run into at speed goes flying.
        const launch=velocity.clone().multiplyScalar(person?1.15:.55);launch.y=Math.max(launch.y,0)+(person?7+horizontal*.18:9);
        throwActor(actor,null,false,launch);velocity.multiplyScalar(person?.85:.6);
        const hitPoint=p.clone().setY(base+1.3);burst(hitPoint,14,[0xfff2a8,0xffffff],{speed:8,up:2,life:.4,size:.3});
        playEffect('impact',p);impactFeedback(1+horizontal/18);
        if(person){playVoice(p,'yelp');say(actor,'hit',.55);awardChaos(Math.round(60+horizontal*8),onGround?pick(['BODY CHECK','SHOULDER BARGE','EXCUSE ME']):pick(['SPIDER-TACKLE','DROP-IN','AIRMAIL']),hitPoint);}
        else awardChaos(500,'CAR CHECK',hitPoint);
        continue;
      }
      const penetrationX=actor.hx+.38-Math.abs(position.x-p.x);
      const penetrationZ=actor.hz+.38-Math.abs(position.z-p.z);
      if(penetrationX<penetrationZ) {
        const side=position.x===p.x ? (previous.x<p.x?-1:1) : Math.sign(position.x-p.x);
        position.x=p.x+side*(actor.hx+.38); if(velocity.x*side<0) velocity.x=0;
      } else {
        const side=position.z===p.z ? (previous.z<p.z?-1:1) : Math.sign(position.z-p.z);
        position.z=p.z+side*(actor.hz+.38); if(velocity.z*side<0) velocity.z=0;
      }
    }
  }
  function cancelVisit(npc) {
    const visit=npc.visit;
    if(visit?.kind==='car') {
      if(visit.car.waiting===npc) visit.car.waiting=null;
      if(visit.car.passenger===npc) visit.car.passenger=null;
    }
    npc.visit=null;
  }
  function releaseActorWeb(actor) {
    actor.stuck=false;actor.webRemaining=0;
    for(let i=splatters.length-1;i>=0;i--) if(splatters[i].userData.webActor===actor) {
      disposeWeb(splatters[i]);splatters.splice(i,1);
    }
  }
  function nearestRouteCorner(npc) {
    let best=0,distance=Infinity;
    npc.route.forEach((node,i)=>{const d=Math.hypot(node.x-npc.group.position.x,node.z-npc.group.position.z);if(d<distance){distance=d;best=i;}});
    npc.target=best;
  }
  function beginBuildingVisit(npc) {
    const building=buildings.find(b=>b.x===npc.blockX+20 && b.z===npc.blockZ+20);
    if(!building)return false;
    npc.visit={kind:'building',phase:'approach',x:building.x,z:building.z-building.d/2-npc.hz-.12};
    return true;
  }
  function beginCarVisit(npc,car) {
    if(!car || car.stuck || car.waiting || car.passenger || car.hz>2)return false;
    const side=npc.group.position.x>=car.group.position.x?1:-1;
    car.waiting=npc;
    npc.visit={kind:'car',phase:'approach',car,x:car.group.position.x+side*(car.hx+npc.hx+.12),z:car.group.position.z};
    return true;
  }
  function enterVisit(npc) {
    const visit=npc.visit;visit.phase='inside';visit.time=4+random(npc.seed+elapsed)*5;
    npc.group.visible=false;
    if(visit.kind==='car') {visit.car.waiting=null;visit.car.passenger=npc;}
  }
  function finishVisit(npc) {
    const visit=npc.visit;
    if(visit.kind==='car') {
      const car=visit.car, gridX=Math.round(car.group.position.x/40)*40;
      const side=car.group.position.x>=gridX?1:-1;
      const blockX=THREE.MathUtils.clamp(side>0?gridX:gridX-40,-240,200);
      const blockZ=THREE.MathUtils.clamp(Math.floor(car.group.position.z/40)*40,-240,800);
      npc.blockX=blockX;npc.blockZ=blockZ;
      npc.route=[{x:blockX+6.4,z:blockZ+6.4},{x:blockX+33.6,z:blockZ+6.4},{x:blockX+33.6,z:blockZ+33.6},{x:blockX+6.4,z:blockZ+33.6}];
      npc.group.position.set(gridX+side*6.4,.45,THREE.MathUtils.clamp(car.group.position.z,blockZ+6.4,blockZ+33.6));
    }
    cancelVisit(npc);npc.group.visible=true;npc.pause=.6;nearestRouteCorner(npc);
  }
  function cancelDonation(npc) {
    if(!npc.donation)return;
    if(npc.donation.coin)npc.donation.coin.removeFromParent();
    npc.donation=null;
  }
  function maybeStartDonation(npc) {
    if(npc.visit || !npc.group.visible)return;
    if(!npc.donationHistory)npc.donationHistory=new Map();
    for(const shelter of pedestrians) {
      if(!shelter.settled || !shelter.cup)continue;
      const distance=Math.hypot(npc.group.position.x-shelter.group.position.x,npc.group.position.z-shelter.group.position.z);
      const history=npc.donationHistory.get(shelter);
      if(history && distance>4)history.left=true;
      if(distance<1.9 && !shelter.stuck && shelter.webPose===0 && (!history || (history.left && elapsed-history.time>30))) {
        npc.donationHistory.set(shelter,{time:elapsed,left:false});
        npc.donation={shelter,time:0,coin:null};return;
      }
    }
  }
  function updateDonation(npc,dt) {
    const donation=npc.donation,shelter=donation.shelter;
    if(shelter.stuck || !shelter.group.visible){cancelDonation(npc);return;}
    donation.time+=dt;
    const dx=shelter.group.position.x-npc.group.position.x,dz=shelter.group.position.z-npc.group.position.z;
    npc.group.rotation.y=Math.atan2(-dx,-dz);
    if(npc.wheelchair)restoreWheelchair(npc);else npc.leftLeg.rotation.x=npc.rightLeg.rotation.x=0;
    npc.rightArm.rotation.x=-Math.min(1,donation.time*4)*1.05;
    if(donation.time>=.25 && !donation.coin) {donation.coin=new THREE.Mesh(coinGeo,goldMat);scene.add(donation.coin);}
    if(donation.coin) {
      npc.group.updateWorldMatrix(true,true);shelter.group.updateWorldMatrix(true,true);
      const from=npc.rightArm.localToWorld(new THREE.Vector3(0,-.51,0));
      const to=shelter.cup.localToWorld(new THREE.Vector3(0,.03,0));
      const t=THREE.MathUtils.clamp((donation.time-.25)/.8,0,1);
      donation.coin.position.lerpVectors(from,to,t);donation.coin.position.y+=Math.sin(Math.PI*t)*.25;
      donation.coin.rotation.set(Math.PI/2,elapsed*8,0);
      if(t>=1) {
        shelter.cup.add(donation.coin);
        const count=shelter.cupCoins.length;
        donation.coin.position.set((random(count+1)-.5)*.06,.03+(count%3)*.008,(random(count+9)-.5)*.06);
        donation.coin.rotation.set(0,random(count+3)*Math.PI,0);shelter.cupCoins.push(donation.coin);
        if(shelter.cupCoins.length>12)shelter.cupCoins.shift().removeFromParent();
        donation.coin=null;npc.donation=null;npc.rightArm.rotation.x=0;npc.pause=.3;
      }
    }
  }
  function updateWebbedPedestrian(npc,dt) {
    if(npc.stuck) {
      npc.webRemaining=Math.max(0,npc.webRemaining-dt);npc.webPose=Math.min(1,npc.webPose+dt*2.2);
      const wriggle=Math.sin(elapsed*9+npc.seed);
      npc.group.rotation.x=npc.webPose*(Math.PI/2+.06*wriggle);
      npc.group.rotation.z=npc.webPose*.08*Math.sin(elapsed*7+npc.seed);
      npc.leftLeg.rotation.x=.18*wriggle;npc.rightLeg.rotation.x=-.15*wriggle;
      npc.leftArm.rotation.x=.16*wriggle;npc.rightArm.rotation.x=-.13*wriggle;
      npc.top=npc.uprightTop*(1-npc.webPose)+.65*npc.webPose;
      if(npc.webRemaining<=0)releaseActorWeb(npc);
      return true;
    }
    if(npc.webPose>0) {
      npc.webPose=Math.max(0,npc.webPose-dt*1.2);npc.group.rotation.x=npc.webPose*Math.PI/2;npc.group.rotation.z=0;
      npc.top=npc.uprightTop*(1-npc.webPose)+.65*npc.webPose;
      if(npc.webPose===0 && npc.settled)seatedRest(npc);
      if(npc.webPose===0 && npc.rooftopKind==='view')rooftopRest(npc);
      if(npc.webPose===0 && npc.wheelchair)restoreWheelchair(npc);
      return true;
    }
    return false;
  }
  function laneClear(car,laneX,actors) {
    const p=car.group.position;
    for(const other of actors) {
      if(other===car || !other.group.visible || other.rooftop)continue;
      if(Math.abs(other.group.position.x-laneX)<car.hx+other.hx+.3 &&
         other.group.position.z<p.z+10 && other.group.position.z>p.z-13)return false;
    }
    return !(position.y<car.top && Math.abs(position.x-laneX)<car.hx+.68 && position.z<p.z+10 && position.z>p.z-13);
  }
  function obstacleAhead(car,actors) {
    const p=car.group.position;let nearest=Infinity;
    for(const other of actors) {
      if(other===car || !other.group.visible || other.rooftop)continue;
      const gap=p.z-other.group.position.z-car.hz-other.hz;
      if(gap<-.2 || gap>14 || Math.abs(p.x-other.group.position.x)>=car.hx+other.hx+.25)continue;
      const slow=!cars.includes(other) || other.stuck || other.waiting || other.currentSpeed<car.speed*.8;
      if(slow)nearest=Math.min(nearest,Math.max(0,gap));
    }
    const playerGap=p.z-position.z-car.hz-.38;
    if(position.y<car.top && playerGap>=-.2 && playerGap<14 && Math.abs(p.x-position.x)<car.hx+.63)nearest=Math.min(nearest,Math.max(0,playerGap));
    return nearest;
  }
  function updateCurvedTraffic(car,actors,dt) {
    const p=car.group.position,oldX=p.x,oldZ=p.z,path=car.curvedRoute;
    const tangent=path.getTangentAt(car.routeProgress);
    if(car.stuck) {
      car.webRemaining=Math.max(0,car.webRemaining-dt);car.webElapsed+=dt;
      car.currentSpeed=Math.max(0,car.currentSpeed-(car.roll?3.3:2.4)*dt);
      if(car.roll) {
        const t=Math.min(1,car.webElapsed/2.8),angle=t*t*(3-2*t)*Math.PI*2;
        car.group.rotation.z=angle;p.y=car.top*.5*(1-Math.cos(angle))+car.hx*Math.abs(Math.sin(angle));
      }
    } else if(car.waiting) car.currentSpeed=0;
    else {
      let gap=Infinity;
      for(const other of actors) {
        if(other===car || !other.group.visible || other.rooftop)continue;
        const dx=other.group.position.x-p.x,dz=other.group.position.z-p.z;
        const ahead=dx*tangent.x+dz*tangent.z,side=Math.abs(dx*tangent.z-dz*tangent.x);
        if(ahead>0 && ahead<14 && side<car.hx+Math.max(other.hx,other.hz)+.3)gap=Math.min(gap,ahead-car.hz-Math.max(other.hx,other.hz));
      }
      if(position.y<car.top) {
        const dx=position.x-p.x,dz=position.z-p.z,ahead=dx*tangent.x+dz*tangent.z;
        if(ahead>0 && ahead<14 && Math.abs(dx*tangent.z-dz*tangent.x)<car.hx+.65)gap=Math.min(gap,ahead-car.hz-.38);
      }
      const target=gap===Infinity?car.speed:Math.min(car.speed,Math.max(0,gap*1.3));
      car.currentSpeed+=THREE.MathUtils.clamp(target-car.currentSpeed,-10*dt,3*dt);
    }
    const next=(car.routeProgress+car.currentSpeed*dt/car.routeLength)%1,point=path.getPointAt(next);
    p.x=point.x;p.z=point.z;
    if(actorBlocked(car,oldX,oldZ,actors)){p.x=oldX;p.z=oldZ;car.currentSpeed=0;}
    else {car.routeProgress=next;const direction=path.getTangentAt(next);car.group.rotation.y=Math.atan2(-direction.x,-direction.z);}
    if(car.stuck && car.webRemaining<=0){releaseActorWeb(car);car.roll=false;car.group.rotation.z=0;p.y=0;}
  }
  function updateTraffic(car,actors,dt) {
    if(car.curvedRoute){updateCurvedTraffic(car,actors,dt);return;}
    const p=car.group.position,oldX=p.x,oldZ=p.z;
    if(car.stuck) {
      car.webRemaining=Math.max(0,car.webRemaining-dt);car.webElapsed+=dt;
      p.z-=car.currentSpeed*dt;
      p.x=THREE.MathUtils.clamp(p.x+car.lateralSpeed*dt,car.roadX-4.2+car.hx,car.roadX+4.2-car.hx);
      car.currentSpeed=Math.max(0,car.currentSpeed-(car.roll?3.3:2.4)*dt);
      car.lateralSpeed*=Math.exp(-2*dt);
      if(car.roll) {
        const t=Math.min(1,car.webElapsed/2.8),smooth=t*t*(3-2*t),angle=smooth*Math.PI*2;
        car.group.rotation.z=angle;car.group.position.y=car.top*.5*(1-Math.cos(angle))+car.hx*Math.abs(Math.sin(angle));
      }
      if(actorBlocked(car,oldX,oldZ,actors)){p.x=oldX;p.z=oldZ;car.currentSpeed=0;car.lateralSpeed=0;}
      if(car.webRemaining<=0){releaseActorWeb(car);car.roll=false;car.group.rotation.z=0;p.y=0;car.laneCooldown=1;}
      return;
    }
    if(car.waiting){car.currentSpeed=0;car.lateralSpeed=0;return;}
    car.laneCooldown=Math.max(0,car.laneCooldown-dt);
    const obstacle=obstacleAhead(car,actors),opposite=car.roadX-(car.preferredLane-car.roadX);
    if(obstacle<11 && car.laneCooldown===0 && Math.abs(car.laneTarget-opposite)>.1 && laneClear(car,opposite,actors)) {
      car.laneTarget=opposite;car.laneCooldown=3;
    } else if(obstacle===Infinity && car.laneCooldown===0 && Math.abs(car.laneTarget-car.preferredLane)>.1 && laneClear(car,car.preferredLane,actors)) {
      car.laneTarget=car.preferredLane;car.laneCooldown=3;
    }
    const targetSpeed=obstacle===Infinity?car.speed:Math.min(car.speed,Math.max(0,obstacle*1.5));
    const acceleration=targetSpeed<car.currentSpeed?10:3;
    car.currentSpeed+=THREE.MathUtils.clamp(targetSpeed-car.currentSpeed,-acceleration*dt,acceleration*dt);
    p.x+=THREE.MathUtils.clamp(car.laneTarget-p.x,-2.8*dt,2.8*dt);
    p.z-=car.currentSpeed*dt;
    if(p.z<car.minZ)p.z=car.maxZ;
    if(actorBlocked(car,oldX,oldZ,actors)){p.x=oldX;p.z=oldZ;car.currentSpeed=0;}
    car.lateralSpeed=dt>0?(p.x-oldX)/dt:0;
  }
  function updateDogs(dt) {
    for(const dog of dogs) {
      if(nuke?.hitDogs.has(dog))continue;
      const owner=dog.owner,visible=owner.group.visible&&!owner.dead;
      dog.group.visible=visible;dog.leash.visible=visible;if(!visible)continue;
      const yaw=owner.group.rotation.y;
      const target=new THREE.Vector3(owner.group.position.x+Math.cos(yaw)*.85+Math.sin(yaw)*.35,
        dog.group.position.y,owner.group.position.z-Math.sin(yaw)*.85+Math.cos(yaw)*.35);
      const before=dog.group.position.clone();dog.group.position.lerp(target,1-Math.exp(-(waterAt(dog.group.position.x,dog.group.position.z)?2:4)*dt));
      // Sample the surface under the dog itself, including when its owner is not a park walker.
      const p=dog.group.position;
      const wet=waterAt(p.x,p.z);p.y=wet?wet.floor+.45:inPark(p.x,p.z)?.06+parkElevation(p.x,p.z):owner.parkWalker?owner.group.position.y:.45;
      dog.group.rotation.y=yaw;
      const moved=dog.group.position.distanceTo(before);dog.phase+=moved*15;
      if(dog.mixer) {
        const walking=dt>0 && moved/dt>.18;
        if(walking!==dog.dogWalking) {
          const from=walking?dog.idleAction:dog.walkAction,to=walking?dog.walkAction:dog.idleAction;
          to.reset().play();from.crossFadeTo(to,.2,false);dog.dogWalking=walking;
        }
        dog.mixer.update(dt);
      } else for(let i=0;i<dog.legs.length;i++)dog.legs[i].rotation.x=Math.sin(dog.phase+(i%3?Math.PI:0))*Math.min(.45,moved*12);
      owner.group.updateWorldMatrix(true,true);dog.group.updateWorldMatrix(true,true);
      const from=owner.rightArm.localToWorld(new THREE.Vector3(0,-.43,0));
      const to=dog.group.localToWorld(new THREE.Vector3(0,.62,-.30));
      const coords=dog.leash.geometry.attributes.position;coords.setXYZ(0,from.x,from.y,from.z);coords.setXYZ(1,to.x,to.y,to.z);coords.needsUpdate=true;dog.leash.geometry.computeBoundingSphere();
    }
  }
  function recoverKnockback(actor) {
    if(!actor.knockback)return;
    actor.group.position.y=actor.knockback.ground;
    actor.group.rotation.x=0;actor.group.rotation.z=0;actor.knockback=null;
    if(cars.includes(actor)) {
      if(actor.curvedRoute) {
        // Rejoin the closest point after a collision throws a car off its route.
        let best=Infinity;
        for(let i=0;i<400;i++) {
          const t=i/400,p=actor.curvedRoute.getPointAt(t),distance=p.distanceToSquared(actor.group.position);
          if(distance<best){best=distance;actor.routeProgress=t;}
        }
        const p=actor.curvedRoute.getPointAt(actor.routeProgress);actor.group.position.set(p.x,0,p.z);
      }
      actor.roadX=THREE.MathUtils.clamp(Math.round(actor.group.position.x/40)*40,actor.roadMin,actor.roadMax);
      actor.preferredLane=actor.roadX+(actor.group.position.x>=actor.roadX?2:-2);
      actor.laneTarget=actor.preferredLane;actor.currentSpeed=0;actor.lateralSpeed=0;actor.laneCooldown=1;
    } else if(pedestrians.includes(actor)) {
      actor.top=actor.uprightTop;
      actor.leftArm.rotation.x=actor.rightArm.rotation.x=0;
      if(actor.settled){seatedRest(actor);if(actor.rooftopKind==='view')rooftopRest(actor);}else if(actor.wheelchair)restoreWheelchair(actor);else nearestRouteCorner(actor);
      actor.pause=1;
    }
  }
  function throwActor(actor,direction,lethal=false,launch=null) {
    if(actor.dead || actor.knockback || actor.webHeld || actor.webPinned || !actor.group.visible)return;
    if(launch){
      if(pedestrians.includes(actor)){cancelVisit(actor);cancelDonation(actor);}
      if(actor.stuck)releaseActorWeb(actor);
      if(cars.includes(actor) && actor.waiting){cancelVisit(actor.waiting);actor.waiting=null;}
      actor.knockback={ground:actor.group.position.y,velocity:launch.clone(),spin:(Math.random()>.5?1:-1)*(5+launch.length()*.15),time:0,lethal,fromPlayer:true,bounces:0,chain:0};
      actor.group.position.y+=.08;if(pedestrians.includes(actor) && launch.length()>18)say(actor,'fly',.35);return;
    }
    if(pedestrians.includes(actor)){cancelVisit(actor);cancelDonation(actor);}
    if(cars.includes(actor) && actor.waiting){cancelVisit(actor.waiting);actor.waiting=null;}
    actor.knockback={ground:actor.group.position.y,velocity:new THREE.Vector3(direction.x*31,15,direction.z*31),spin:(random(elapsed+actor.seed)>.5?1:-1)*6,time:0,lethal};
    actor.group.position.y+=.05;
  }
  function updateKnockback(actor,dt) {
    const flight=actor.knockback;if(!flight)return false;
    if(flight.phase==='down') {
      flight.remaining=Math.max(0,flight.remaining-dt);
      const prone=Math.min(1,flight.remaining);
      actor.group.rotation.x=prone*Math.PI/2;actor.group.rotation.z=0;
      actor.top=actor.uprightTop*(1-prone)+.65*prone;
      if(flight.remaining===0)recoverKnockback(actor);
      return true;
    }
    const p=actor.group.position,oldX=p.x,oldZ=p.z;
    if(flight.splat>0) {
      // Cartoon wall splat: stick spread-eagled, then peel off and slide down.
      flight.splat-=dt;if(flight.splat>0){if(pedestrians.includes(actor)){actor.leftArm.rotation.x=actor.rightArm.rotation.x=-2.7;actor.leftLeg.rotation.x=.25;actor.rightLeg.rotation.x=-.25;}return true;}
      flight.velocity.set(0,-1,0);flight.spin=.6;
    }
    flight.time+=dt;flight.velocity.y-=(flight.rescue?4:22)*gravityScale*dt;p.addScaledVector(flight.velocity,dt);
    const flightSpeed=Math.hypot(flight.velocity.x,flight.velocity.z);
    if(flight.fromPlayer && !flight.hitBoss && flightSpeed>9) {
      // Anything you throw at a villain counts as an attack.
      for(const boss of bosses) {
        const q=boss.actor.group.position;if(boss.status!=='active' || boss.actor===actor)continue;
        if(Math.hypot(q.x-p.x,q.z-p.z)<(boss.actor===rhino?3.2:2.2) && p.y>q.y-1 && p.y<q.y+(boss.actor===rhino?4.5:3)) {
          flight.hitBoss=true;flight.velocity.multiplyScalar(-.3);playEffect('impact',q);impactFeedback(2.5);
          damageBoss(boss.actor,cars.includes(actor)?4:3,cars.includes(actor)?'CAR MISSILE':pedestrians.includes(actor)?'HUMAN MISSILE':'PROP MISSILE',q.clone().setY(q.y+3));
        }
      }
    }
    if(flight.fromPlayer && flightSpeed>11 && pedestrians.includes(actor)) {
      // Flying people bowl over anyone they hit.
      for(const other of pedestrians) {
        if(other===actor || other.dead || other.knockback || other.webHeld || other.webPinned || !other.group.visible)continue;
        const q=other.group.position;if(Math.abs(q.x-p.x)>1 || Math.abs(q.z-p.z)>1 || p.y-q.y>2.2 || q.y-p.y>1)continue;
        throwActor(other,null,false,flight.velocity.clone().multiplyScalar(.75).add(new THREE.Vector3(0,7,0)));
        if(other.knockback)other.knockback.chain=(flight.chain||0)+1;
        flight.velocity.multiplyScalar(.7);flight.chain=(flight.chain||0)+1;
        playVoice(q,'yelp');burst(q.clone().setY(q.y+1.2),10,[0xfff2a8,0xffffff],{speed:7,life:.35,size:.25});
        awardChaos(flight.chain>=3?600:200,flight.chain>=3?'STRIKE!':'HUMAN BOWLING',q.clone().setY(q.y+2));
      }
    }
    const water=waterAt(p.x,p.z);
    if(water){flight.ground=water.floor;if(p.y<water.surface+.2){flight.velocity.x*=Math.exp(-2.5*dt);flight.velocity.z*=Math.exp(-2.5*dt);flight.spin*=Math.exp(-2*dt);}}
    for(const b of buildings) {
      if(b.destroyed)continue;
      if(p.y>b.height || (b.shape?!insideBuilding(p.x,p.z,b,Math.max(actor.hx,actor.hz)):(Math.abs(p.x-b.x)>=b.w/2+actor.hx || Math.abs(p.z-b.z)>=b.d/2+actor.hz)))continue;
      if(b.shape && !insideBuilding(oldX,oldZ,b,Math.max(actor.hx,actor.hz))){p.x=oldX;p.z=oldZ;flight.velocity.x*=-.35;flight.velocity.z*=-.35;continue;}
      const hitX=Math.abs(oldX-b.x)>=b.w/2+actor.hx,hitZ=Math.abs(oldZ-b.z)>=b.d/2+actor.hz;
      if(flight.fromPlayer && !flight.splatted && flightSpeed>13 && (hitX||hitZ) && pedestrians.includes(actor)) {
        flight.splatted=true;flight.splat=1.1;p.x=oldX;p.z=oldZ;
        actor.group.rotation.set(0,hitX?(oldX<b.x?-Math.PI/2:Math.PI/2):(oldZ<b.z?0:Math.PI),0);
        playEffect('splat',p);playVoice(p,'grunt');burst(p.clone().setY(p.y+1.2),16,[0xffffff,0xd8d0c4],{speed:5,life:.5,size:.4});
        awardChaos(350,'WALL SPLAT',p.clone().setY(p.y+2.4));say(actor,'hit',.7);continue;
      }
      if(hitX){p.x=oldX;flight.velocity.x*=-.35;}
      if(hitZ){p.z=oldZ;flight.velocity.z*=-.35;}
    }
    p.x=THREE.MathUtils.clamp(p.x,worldMinX,worldMaxX);p.z=THREE.MathUtils.clamp(p.z,worldMinZ,worldMaxZ);
    actor.group.rotation.x+=flight.spin*dt;actor.group.rotation.z+=flight.spin*.6*dt;
    if(pedestrians.includes(actor)) {
      actor.leftArm.rotation.x=Math.sin(flight.time*10)*1.3;actor.rightArm.rotation.x=-actor.leftArm.rotation.x;
      actor.leftLeg.rotation.x=Math.sin(flight.time*9)*.9;actor.rightLeg.rotation.x=-actor.leftLeg.rotation.x;
    }
    if(p.y<=flight.ground && flight.velocity.y<0) {
      if(flight.velocity.y<-9 && (flight.bounces||0)<2 && !flight.lethal) {
        // Bounce a couple of times before settling.
        p.y=flight.ground+.02;flight.velocity.y*=-.38;flight.velocity.x*=.6;flight.velocity.z*=.6;flight.bounces=(flight.bounces||0)+1;flight.spin*=.6;
        playEffect('land',p);burst(p.clone().setY(p.y+.2),8,0xcfc7b8,{speed:3,up:1.5,life:.6,gravity:2,size:.6});
        if(pedestrians.includes(actor))playVoice(p,'grunt');return true;
      }
      if(pedestrians.includes(actor)) {
        p.y=flight.ground;
        if(flight.fromPlayer && flight.time>1.2)awardChaos(Math.round(flight.time*120),`AIRTIME ${flight.time.toFixed(1)}s`,p.clone().setY(p.y+1.5));
        if(water)burst(p.clone().setY(water.surface+.1),24,[0xd8f4ff,0x8fd1e8],{speed:6,up:7,life:.9,size:.35});
        if(flight.lethal){civilianCasualty(actor);return true;}
        if(flight.fromPlayer)say(actor,'land',.5);
        flight.phase='down';flight.remaining=6;
        actor.group.rotation.set(Math.PI/2,actor.group.rotation.y,0);actor.top=.65;
        actor.leftArm.rotation.x=.35;actor.rightArm.rotation.x=-.35;
        actor.leftLeg.rotation.x=.2;actor.rightLeg.rotation.x=-.2;
      } else recoverKnockback(actor);
    }
    return true;
  }
  function clearRescue() {
    if(!rescue)return;
    rescue.marker.removeFromParent();rescue.marker.geometry.dispose();rescue.marker.material.dispose();
    rescue=null;
  }
  function startRescue(type) {
    const list=type==='fall'?pedestrians:cars;
    const candidates=list.filter(a=>a.group.visible&&!a.dead&&!a.stuck&&!a.knockback&&!a.webPinned&&!a.webHeld&&!a.rooftop&&!a.settled&&!a.protester&&!a.dog&&!a.wheelchair&&!a.curvedRoute&&!a.waiting&&!a.passenger&&Math.hypot(a.group.position.x-position.x,a.group.position.z-position.z)<100);
    if(!candidates.length)return false;
    candidates.sort((a,b)=>a.group.position.distanceToSquared(position)-b.group.position.distanceToSquared(position));
    const actor=candidates[0];
    if(type==='fall') {
      cancelVisit(actor);cancelDonation(actor);
      actor.group.position.y=Math.max(55,Math.min(100,position.y+45));
      actor.knockback={ground:inPark(actor.group.position.x,actor.group.position.z)?.1:.45,velocity:new THREE.Vector3(0,-1,0),spin:1.4,time:0,lethal:true,rescue:true};
    } else {actor.currentSpeed=14;actor.lateralSpeed=0;}
    const marker=new THREE.Mesh(new THREE.TorusGeometry(.8,.08,6,24),new THREE.MeshBasicMaterial({color:0xffc75e,transparent:true,opacity:.85}));
    marker.userData.projectile=true;scene.add(marker);
    playEffect('alert',actor.group.position);rescue={type,actor,marker,time:0,result:'active',hits:new Set()};showRescueNotice(type);return true;
  }
  function updateRescue(dt) {
    if(nuke){if(rescue)clearRescue();return;}
    if(!rescue) {
      rescueTimer-=dt;if(rescueTimer>0)return;
      const type=rescueSequence++%2===0?'fall':'runaway';rescueTimer=startRescue(type)?28:6;return;
    }
    const event=rescue,actor=event.actor;event.time+=dt;
    event.marker.position.copy(actor.group.position).add(new THREE.Vector3(0,actor.top+1.2,0));
    event.marker.rotation.y+=dt*2;event.marker.scale.setScalar(1+.12*Math.sin(elapsed*6));
    if(event.result!=='active'){if(event.time>2){clearRescue();rescueTimer=25;}return;}
    let success=false,failed=false;
    if(event.type==='fall') {
      success=Boolean(actor.webPinned && actor.webPinned.elapsed>=actor.webPinned.duration);
      failed=actor.dead;
      if(!success&&!failed&&!actor.webHeld&&!actor.webPinned&&!actor.knockback) {
        actor.knockback={ground:inPark(actor.group.position.x,actor.group.position.z)?.1:.45,velocity:new THREE.Vector3(0,-2,0),spin:1.4,time:0,lethal:true,rescue:true};
      }
    } else {
      success=Boolean((actor.webPinned && actor.webPinned.elapsed>=actor.webPinned.duration) || (actor.stuck && !actor.webPinned && actor.currentSpeed<1));
      failed=event.time>20 || event.hits.size>=2;
    }
    if(success||failed){const where=actor.group.position.clone().setY(actor.group.position.y+2.5);if(success){awardChaos(event.type==='fall'?800:600,'HERO MOMENT',where,'hero');burst(where,40,confetti,{speed:9,up:6,life:1.4,size:.3});if(event.type==='fall')say(actor,'saved');}else awardChaos(400,event.type==='fall'?'MORAL FLEXIBILITY':'NOT MY PROBLEM',where,'oops');playEffect(success?'success':'failure');event.result=success?'success':'failed';event.time=0;event.marker.material.color.setHex(success?0x75ed9d:0xd65b50);}
  }
  function updateRunaway(car,actors,dt) {
    const p=car.group.position,oldZ=p.z;car.currentSpeed=Math.min(22,car.currentSpeed+4*dt);p.z-=car.currentSpeed*dt;
    if(p.z<car.minZ)p.z=car.maxZ;
    for(const actor of actors) {
      if(actor===car || !pedestrians.includes(actor) || !actor.group.visible || actor.rooftop || rescue.hits.has(actor))continue;
      const q=actor.group.position;
      if(Math.abs(q.x-p.x)<car.hx+actor.hx && q.z<=oldZ+actor.hz && q.z>=p.z-car.hz-actor.hz) {
        rescue.hits.add(actor);throwActor(actor,new THREE.Vector3(0,0,-1));
      }
    }
  }
  function updateRhino(dt,actors) {
    if(rhino.boss.status!=='active')return;
    if(nuke?.hitActors.has(rhino) || rhino.webHeld || updateWebPin(rhino,dt) || updateKnockback(rhino,dt))return;
    const p=rhino.group.position;
    if(rhino.state==='subdued') {
      rhino.webRemaining-=dt;rhino.body.rotation.x=.35+Math.sin(elapsed*6)*.04;
      if(rhino.webRemaining<=0){releaseActorWeb(rhino);rhino.webHits=0;rhino.state='recover';rhino.timer=2;}
      return;
    }
    rhino.timer-=dt*(rhino.enraged?1.6:1);
    if(rhino.state==='stagger'||rhino.state==='recover') {
      rhino.body.rotation.x+=(0-rhino.body.rotation.x)*(1-Math.exp(-5*dt));
      for(const limb of [...rhino.arms,...rhino.legs])limb.rotation.x*=Math.exp(-6*dt);
      if(rhino.timer<=0)rhino.state='roam';
      return;
    }
    if(rhino.state==='roam') {
      let target=null,best=55;
      const playerDistance=Math.hypot(position.x-p.x,position.z-p.z);
      if(position.y<7 && playerDistance<best){target=position;best=playerDistance;}
      if(!target)for(const actor of actors) {
        if(!actor.group.visible || actor.rooftop || actor.knockback || actor.webHeld || actor.webPinned)continue;
        const d=Math.hypot(actor.group.position.x-p.x,actor.group.position.z-p.z);
        if(d<best){target=actor.group.position;best=d;}
      }
      if(target) {
        rhino.direction.set(target.x-p.x,0,target.z-p.z).normalize();
        if(rhino.direction.lengthSq()===0)rhino.direction.set(0,0,1);
        rhino.group.rotation.y=Math.atan2(-rhino.direction.x,-rhino.direction.z);
        playEffect('alert',rhino.group.position);rhino.state='windup';rhino.timer=1.15;
      }
      return;
    }
    if(rhino.state==='windup') {
      rhino.body.rotation.x=-.30+Math.sin(elapsed*18)*.035;
      if(rhino.timer<=0){rhino.state='charge';rhino.timer=2.6;rhino.hitActors.clear();}
      return;
    }
    if(rhino.state==='charge') {
      const old=p.clone();p.addScaledVector(rhino.direction,(rhino.enraged?40:30)*dt);
      let obstruction=buildings.find(b=>insideBuilding(p.x,p.z,b,1.1));
      if(obstruction?.parts){damageBuilding(obstruction,5);obstruction=null;}
      const blocked=p.x<worldMinX||p.x>worldMaxX||p.z<worldMinZ||p.z>worldMaxZ||Boolean(waterAt(p.x,p.z))||Boolean(obstruction);
      if(blocked){p.copy(old);rhino.state='recover';rhino.timer=2;}
      const stride=Math.sin(elapsed*17);
      rhino.body.rotation.x=.38;rhino.arms[0].rotation.x=stride*.5-.5;rhino.arms[1].rotation.x=-stride*.5-.5;
      rhino.legs[0].rotation.x=-stride*.6;rhino.legs[1].rotation.x=stride*.6;
      // Check the full segment travelled this frame, so fast charges cannot skip targets.
      const segment=p.clone().sub(old),lengthSq=segment.lengthSq();
      const near=(point,radius)=>{const t=lengthSq?THREE.MathUtils.clamp(point.clone().sub(old).dot(segment)/lengthSq,0,1):0;return Math.hypot(point.x-old.x-segment.x*t,point.z-old.z-segment.z*t)<radius;};
      if(!rhino.hitActors.has('player') && position.y<4 && near(position,1.8)) {
        rhino.hitActors.add('player');cancelWebGrab();swing(false);velocity.set(rhino.direction.x*38,18,rhino.direction.z*38);position.y=Math.max(.1,position.y);onGround=false;playerImpact=1.2;
      }
      for(const actor of actors)if(!rhino.hitActors.has(actor)&&!actor.rooftop&&actor.group.visible&&near(actor.group.position,1.5+Math.max(actor.hx,actor.hz))) {
        rhino.hitActors.add(actor);throwActor(actor,rhino.direction,true);
      }
      if(rhino.timer<=0){rhino.state='recover';rhino.timer=2;}
    }
  }
  function enemyFlash(point,radius,electric=false) {
    const mesh=new THREE.Mesh(attackRingGeometry,electric?electricFlashMaterial:bombFlashMaterial);
    mesh.position.copy(point);mesh.rotation.x=-Math.PI/2;scene.add(mesh);
    enemyEffects.push({mesh,radius,time:.4});
  }
  function hitPlayer(direction,power,lift,electric=false) {
    if(attackImmunity>0)return;
    playEffect(electric?'electric':'impact');attackImmunity=.45;cancelWebGrab();swing(false);
    const horizontal=new THREE.Vector3(direction.x,0,direction.z);
    if(horizontal.lengthSq()<.001)horizontal.set(0,0,1);else horizontal.normalize();
    velocity.addScaledVector(horizontal,power);velocity.y=Math.max(velocity.y,lift);
    position.y=Math.max(.1,position.y);onGround=false;playerImpact=Math.max(playerImpact,.9);
    if(electric)shockTime=1.2;
  }
  function enemyBlast(point,radius,actors,electric=false) {
    playEffect(electric?'electric':'impact',point);recentDanger={position:point.clone(),time:5};
    enemyFlash(point,radius,electric);
    const playerCenter=position.clone().add(new THREE.Vector3(0,1,0));
    if(playerCenter.distanceTo(point)<radius+1)hitPlayer(playerCenter.clone().sub(point),electric?12:24,electric?7:13,electric);
    if(!electric) {
      for(const actor of actors) {
        if(!actor.group.visible||actor.rooftop||actor.knockback||actor.webHeld||actor.webPinned)continue;
        const delta=actor.group.position.clone().sub(point);
        if(Math.abs(delta.y)<actor.top+2&&Math.hypot(delta.x,delta.z)<radius+actor.hx) {
          delta.y=0;if(delta.lengthSq()<.01)delta.set(0,0,1);throwActor(actor,delta.normalize(),true);
        }
      }
      const nearby=buildings.find(b=>!b.destroyed&&b.parts&&point.y<b.height+3&&Math.abs(point.x-b.x)<b.w/2+radius&&Math.abs(point.z-b.z)<b.d/2+radius);
      if(nearby)damageBuilding(nearby,1);
    }
  }
  function fireEnemyShot(villain) {
    const electric=villain.kind==='electro',origin=villain.group.position.clone().add(new THREE.Vector3(0,electric?1.5:.3,0));
    playEffect(electric?'electric':'enemy',origin);
    const target=position.clone().add(new THREE.Vector3(0,1,0)),direction=target.sub(origin).normalize();
    const mesh=new THREE.Mesh(villainShotGeometry,electric?electroShotMaterial:goblinBombMaterial);
    const size=electric?.24:.38;mesh.scale.setScalar(size);mesh.position.copy(origin);mesh.userData.projectile=true;scene.add(mesh);
    const velocity=direction.multiplyScalar(electric?32:27);if(!electric)velocity.y+=3;
    enemyProjectiles.push({mesh,velocity,electric,life:3});
  }
  function updateEnemyProjectiles(dt,actors) {
    for(let i=enemyProjectiles.length-1;i>=0;i--) {
      const shot=enemyProjectiles[i],old=shot.mesh.position.clone();shot.life-=dt;
      if(!shot.electric)shot.velocity.y-=9*dt;
      shot.mesh.position.addScaledVector(shot.velocity,dt);
      const p=shot.mesh.position,delta=p.clone().sub(old),lengthSq=delta.lengthSq();
      const playerCenter=position.clone().add(new THREE.Vector3(0,1,0));
      const t=lengthSq?THREE.MathUtils.clamp(playerCenter.clone().sub(old).dot(delta)/lengthSq,0,1):0;
      const hitPlayerDirect=playerCenter.distanceToSquared(old.clone().addScaledVector(delta,t))<1.4*1.4;
      const hitBuilding=buildings.some(b=>p.y>=0&&p.y<b.height&&insideBuilding(p.x,p.z,b,0));
      if(hitPlayerDirect||p.y<=0||hitBuilding||shot.life<=0) {
        if(shot.life>0)enemyBlast(p,shot.electric?1.8:5,actors,shot.electric);
        scene.remove(shot.mesh);enemyProjectiles.splice(i,1);
      }
    }
    for(let i=enemyEffects.length-1;i>=0;i--) {
      const effect=enemyEffects[i];effect.time-=dt;
      effect.mesh.scale.setScalar(effect.radius*(1-effect.time/.4));
      if(effect.time<=0){scene.remove(effect.mesh);enemyEffects.splice(i,1);}
    }
  }
  function updateVillains(dt,actors) {
    for(const villain of villains) {
      if(villain.boss.status!=='active')continue;
      if(nuke?.hitActors.has(villain) || villain.webHeld || updateWebPin(villain,dt) || updateKnockback(villain,dt))continue;
      const p=villain.group.position;
      if(villain.state==='subdued') {
        villain.webRemaining-=dt;villain.body.rotation.z=.15*Math.sin(elapsed*5);
        if(villain.webRemaining<=0){releaseActorWeb(villain);villain.webHits=0;villain.state='cooldown';villain.timer=2;villain.body.rotation.z=0;}
        continue;
      }
      villain.timer=Math.max(0,villain.timer-dt*(villain.enraged?1.7:1));
      const oldPosition=p.clone();
      if(villain.kind==='goblin') {
        const t=elapsed*.32;
        const near=Math.hypot(position.x-p.x,position.z-p.z)<90;
        const center=near?position:villain.spawn;
        const diving=villain.state==='dive';
        const desired=diving?position.clone().add(new THREE.Vector3(0,1.2,0)):new THREE.Vector3(center.x+Math.sin(t)*15,near?THREE.MathUtils.clamp(position.y+15,18,110):villain.spawn.y+Math.sin(t)*2,center.z+Math.cos(t)*15);
        if(diving) {const delta=desired.clone().sub(p),travel=Math.min(delta.length(),32*dt);if(travel>0)p.addScaledVector(delta.normalize(),travel);}
        else p.lerp(desired,1-Math.exp(-.8*dt));
        if(buildings.some(b=>insideBuilding(p.x,p.z,b,2)&&p.y<b.height+4)) {
          p.x=oldPosition.x;p.z=oldPosition.z;p.y=Math.max(p.y,oldPosition.y+8*dt);
        }
        if(diving && (p.distanceTo(desired)<3 || villain.timer===0)) {
          if(p.distanceTo(desired)<3)hitPlayer(position.clone().sub(p),30,14);
          enemyFlash(p,4);villain.state='cooldown';villain.timer=3.5;
        }
      } else {
        const dx=position.x-p.x,dz=position.z-p.z,distance=Math.hypot(dx,dz);
        const stop=villain.kind==='electro'?22:6;
        if(villain.kind==='octopus' && distance<70 && position.y>p.y+4 && villain.state!=='windup' && villain.state!=='stagger') {
          const wall=buildings.filter(b=>!b.destroyed && b.height>p.y+2 && Math.abs(p.x-b.x)<b.w/2+7 && Math.abs(p.z-b.z)<b.d/2+7).sort((a,b)=>Math.hypot(p.x-a.x,p.z-a.z)-Math.hypot(p.x-b.x,p.z-b.z))[0];
          if(wall) {
            const dxWall=p.x-wall.x,dzWall=p.z-wall.z;
            const xGap=Math.abs(Math.abs(dxWall)-wall.w/2),zGap=Math.abs(Math.abs(dzWall)-wall.d/2);
            if(xGap<zGap)p.x+=(wall.x+(dxWall<0?-1:1)*(wall.w/2+.8)-p.x)*Math.min(1,4*dt);
            else p.z+=(wall.z+(dzWall<0?-1:1)*(wall.d/2+.8)-p.z)*Math.min(1,4*dt);
            p.y=Math.min(wall.height,position.y,p.y+7*dt);
          }
        } else if(villain.kind==='octopus' && p.y>0 && position.y<p.y-4)p.y=Math.max(0,p.y-5*dt);
        if(distance>stop&&distance<70&&position.y<25&&villain.state!=='windup'&&villain.state!=='stagger') {
          const oldX=p.x,oldZ=p.z;p.x+=dx/distance*3.4*dt;p.z+=dz/distance*3.4*dt;
          if(buildings.some(b=>insideBuilding(p.x,p.z,b,.7))){p.x=oldX;p.z=oldZ;}
          p.x=THREE.MathUtils.clamp(p.x,worldMinX,worldMaxX);p.z=THREE.MathUtils.clamp(p.z,worldMinZ,worldMaxZ);
        }
      }
      const dx=position.x-p.x,dz=position.z-p.z,distance=Math.hypot(dx,dz);
      if(distance>.1)villain.group.rotation.y=Math.atan2(-dx,-dz);
      const walking=villain.kind!=='goblin' && p.distanceToSquared(oldPosition)>.000001;
      const stride=walking?Math.sin(elapsed*8)*.55:0,windup=villain.state==='windup';
      villain.head.rotation.y=Math.sin(elapsed*1.2)*.07;
      for(let i=0;i<2;i++) {
        const side=i===0?-1:1;
        if(villain.kind==='goblin') {
          villain.arms[i].rotation.set(windup?1.1:.55,0,side*.25);
          villain.elbows[i].rotation.x=windup?-.7:-.45;
          villain.legs[i].rotation.set(.7,0,side*.18);villain.knees[i].rotation.x=-1.0;
        } else {
          villain.arms[i].rotation.set(windup?(villain.kind==='electro'?1.35:.8):side*stride*.7,0,side*(villain.kind==='octopus'?.18:.08));
          villain.elbows[i].rotation.x=windup?-.65:-.12;
          villain.legs[i].rotation.x=-side*stride;villain.knees[i].rotation.x=Math.max(0,side*stride)*-.65;
        }
      }
      if(villain.glider){villain.glider.rotation.z=Math.sin(elapsed*.9)*.10;villain.glider.rotation.x=villain.state==='dive'?.35:0;}
      if(villain.kind==='octopus')villain.limbs.forEach((joints,i)=>{
        const side=i<2?-1:1;
        joints[0].rotation.y=-side*(1.25+Math.sin(elapsed*2+i)*.1);
        joints[1].rotation.x=(windup?-.5:0)+.35*Math.sin(elapsed*2.5+i);
        joints[1].rotation.y=side*(.48+Math.sin(elapsed*2+i)*.1);
        joints[2].rotation.y=side*(.38+Math.sin(elapsed*2+i+1)*.1);
        joints[3].rotation.x=.35*Math.sin(elapsed*2.2+i);
        joints.claws.forEach((claw,j)=>{claw.rotation.y=(j===0?-1:1)*(windup?.8:.35+.2*Math.sin(elapsed*3+i));});
      });
      if(villain.glow)villain.glow.scale.set(.09,.12*(villain.state==='windup'?1.5:1),.02);
      if(villain.state==='windup' && villain.timer===0) {
        if(villain.kind==='octopus') {
          const center=p.clone().add(new THREE.Vector3(0,1,0));enemyFlash(center,7);
          if(distance<8 && Math.abs(position.y-p.y)<5)hitPlayer(new THREE.Vector3(dx,0,dz),28,12);
          for(const actor of actors)if(actor.group.visible&&!actor.rooftop&&Math.hypot(actor.group.position.x-p.x,actor.group.position.z-p.z)<7) {
            const direction=actor.group.position.clone().sub(p);direction.y=0;if(direction.lengthSq()<.01)direction.set(0,0,1);throwActor(actor,direction.normalize());
          }
        } else if(villain.kind==='goblin' && (++villain.attacks%2===0)) {villain.state='dive';villain.timer=2.5;}
        else fireEnemyShot(villain);
        if(villain.state!=='dive'){villain.state='cooldown';villain.timer=villain.kind==='goblin'?3.5:2.8;}
      } else if((villain.state==='stagger'||villain.state==='cooldown')&&villain.timer===0)villain.state='idle';
      if(villain.state==='idle') {
        const vertical=Math.abs(position.y-p.y),range=villain.kind==='octopus'?8:villain.kind==='electro'?55:75;
        if(distance<range && vertical<(villain.kind==='octopus'?5:55)){villain.state='windup';villain.timer=villain.kind==='octopus'?.8:1;}
      }
      villain.body.rotation.x=(villain.kind==='goblin'?.28:0)+(villain.state==='windup'?.2:0);
    }
  }
  // Moving actors only need to check nearby cells for traffic and collisions.
  // Rebuild after traffic moves so pedestrians see cars that have wrapped routes.
  function actorGrid(actors) {
    const cells=new Map();
    for(const actor of actors) {
      const p=actor.group.position,key=`${Math.floor(p.x/40)},${Math.floor(p.z/40)}`;
      if(!cells.has(key))cells.set(key,[]);
      cells.get(key).push(actor);
    }
    return cells;
  }
  function nearbyActors(grid,actor) {
    const p=actor.group.position,x=Math.floor(p.x/40),z=Math.floor(p.z/40),near=[];
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++) {
      const cell=grid.get(`${x+dx},${z+dz}`);if(cell)near.push(...cell);
    }
    return near;
  }
  function activeDangers() {
    const threats=[];
    if(rhino.state==='windup'||rhino.state==='charge')threats.push(rhino.group.position);
    for(const villain of villains)if(villain.state==='windup'||villain.state==='dive')threats.push(villain.group.position);
    if(recentDanger)threats.push(recentDanger.position);
    if(rescue?.type==='runaway' && rescue.result==='active')threats.push(rescue.actor.group.position);
    return threats;
  }
  function fleeDanger(npc,threats,nearby,dt) {
    const p=npc.group.position;let nearest=null,best=24;
    for(const threat of threats) {
      const d=Math.hypot(p.x-threat.x,p.z-threat.z);
      if(d<best && Math.abs(p.y-threat.y)<20){best=d;nearest=threat;}
    }
    if(nearest) {
      if(!npc.fearTimer){cancelVisit(npc);cancelDonation(npc);npc.pause=0;}
      npc.fearTimer=2.5;npc.panicFrom=nearest.clone();
    } else npc.fearTimer=Math.max(0,(npc.fearTimer||0)-dt);
    if(!npc.fearTimer){if(npc.panicFrom){nearestRouteCorner(npc);npc.panicFrom=null;npc.pause=.5;}return false;}
    const dx=p.x-npc.panicFrom.x,dz=p.z-npc.panicFrom.z,length=Math.hypot(dx,dz)||1;
    const oldX=p.x,oldZ=p.z,step=npc.speed*(npc.wheelchair?1.35:2.1)*dt;
    const candidates=[[dx/length,dz/length],[-dz/length,dx/length],[dz/length,-dx/length]];
    for(const [vx,vz] of candidates) {
      p.x=THREE.MathUtils.clamp(oldX+vx*step,worldMinX+1,worldMaxX-1);p.z=THREE.MathUtils.clamp(oldZ+vz*step,worldMinZ+1,worldMaxZ-1);
      const local=buildingCells.get(`${Math.floor(p.x/40)},${Math.floor(p.z/40)}`)||[];
      if((!waterAt(oldX,oldZ) && waterAt(p.x,p.z)) || local.some(b=>insideBuilding(p.x,p.z,b,Math.max(npc.hx,npc.hz))&&!insideBuilding(oldX,oldZ,b,Math.max(npc.hx,npc.hz))) || actorBlocked(npc,oldX,oldZ,nearby))continue;
      if(npc.parkWalker && inPark(p.x,p.z))p.y=waterAt(p.x,p.z)?.floor ?? .1+parkElevation(p.x,p.z);
      npc.group.rotation.y=Math.atan2(-vx,-vz);npc.step+=step*10;
      if(npc.wheelchair){restoreWheelchair(npc);for(const wheel of npc.wheelchair.wheels)wheel.rotateZ(step*2.5);}
      else {const stride=Math.sin(npc.step)*.7;npc.leftLeg.rotation.x=stride;npc.rightLeg.rotation.x=-stride;npc.leftArm.rotation.x=-stride*.8;npc.rightArm.rotation.x=stride*.8;}
      return true;
    }
    p.x=oldX;p.z=oldZ;return true;
  }
  function updateWorld(dt) {
    updateRubble(dt);
    for(const building of destructibleBuildings)if(building.destroyed && building.washers)for(const washer of building.washers)updateWasher(washer,dt);
    const actors=[...cars,...pedestrians.filter(npc=>!npc.dead)];
    updateRhino(dt,[...actors,...chargeProps]);
    updateVillains(dt,actors);updateEnemyProjectiles(dt,actors);
    if(recentDanger){recentDanger.time-=dt;if(recentDanger.time<=0)recentDanger=null;}
    const threats=activeDangers();
    for(const prop of chargeProps)if(!nuke?.hitActors.has(prop))updateKnockback(prop,dt);
    let grid=actorGrid(actors);
    for(const car of cars) {
      if(nuke?.hitActors.has(car))continue;
      const p=car.group.position,oldCell=`${Math.floor(p.x/40)},${Math.floor(p.z/40)}`;
      if(car.beacon) {
        const responding=threats.some(t=>Math.hypot(t.x-p.x,t.z-p.z)<95);
        car.speed=car.normalSpeed*(responding?1.35:1);car.beacon.visible=responding && Math.floor(elapsed*5)%2===0;
      }
      if(!car.webHeld && !updateWebPin(car,dt) && !updateKnockback(car,dt)) {
        if(rescue?.type==='runaway' && rescue.actor===car && rescue.result==='active' && !car.stuck)updateRunaway(car,nearbyActors(grid,car),dt);
        else updateTraffic(car,nearbyActors(grid,car),dt);
        const wet=waterAt(p.x,p.z);
        if(wet && p.y<wet.surface+.7){p.y+=(wet.floor-p.y)*(1-Math.exp(-5*dt));car.currentSpeed*=Math.exp(-2*dt);car.wading=true;}
        else if(car.wading && !wet){p.y+=(0-p.y)*(1-Math.exp(-8*dt));if(p.y>-.02){p.y=0;car.wading=false;}}
      }
      const newCell=`${Math.floor(p.x/40)},${Math.floor(p.z/40)}`;
      if(oldCell!==newCell) {
        const old=grid.get(oldCell),index=old.indexOf(car);if(index>=0)old.splice(index,1);
        if(!grid.has(newCell))grid.set(newCell,[]);grid.get(newCell).push(car);
      }
    }
    grid=actorGrid(actors);
    for(const npc of pedestrians) {
      if(nuke?.hitActors.has(npc))continue;
      if(npc.dead) {
        // Cartoon rules: the flattened get back up eventually.
        if(npc.reviveAt && elapsed>npc.reviveAt && !nuke){npc.dead=false;npc.reviveAt=0;npc.knockback={ground:npc.group.position.y};recoverKnockback(npc);say(npc,'revive');}
        continue;
      }
      if(npc.webHeld || updateWebPin(npc,dt))continue;
      if(updateKnockback(npc,dt))continue;
      if(updateWebbedPedestrian(npc,dt))continue;
      const wet=waterAt(npc.group.position.x,npc.group.position.z);
      if(wet && npc.group.position.y<wet.surface+.7){npc.group.position.y+=(wet.floor-npc.group.position.y)*(1-Math.exp(-5*dt));npc.wading=true;}
      else if(npc.wading && !wet){const ground=npc.parkWalker?.1+parkElevation(npc.group.position.x,npc.group.position.z):.45;npc.group.position.y+=(ground-npc.group.position.y)*(1-Math.exp(-8*dt));if(Math.abs(npc.group.position.y-ground)<.02){npc.group.position.y=ground;npc.wading=false;}}
      if(npc.settled) {
        if(npc.rooftopKind==='washer')npc.rightArm.rotation.x=-1.1+.35*Math.sin(elapsed*2.4+npc.seed);
        else if(npc.rooftopKind==='view')npc.head.rotation.y=.2*Math.sin(elapsed*.4+npc.seed);
        continue;
      }
      if(npc.visit?.phase==='inside') {
        npc.visit.time-=dt;if(npc.visit.time<=0)finishVisit(npc);continue;
      }
      if(fleeDanger(npc,threats,nearbyActors(grid,npc),dt))continue;
      if(npc.visit?.kind==='car' && npc.visit.car.stuck) {cancelVisit(npc);nearestRouteCorner(npc);}
      if(!npc.protester && !npc.donation)maybeStartDonation(npc);
      if(npc.donation){updateDonation(npc,dt);continue;}
      const p=npc.group.position;
      if(npc.pause>0) {
        npc.pause=Math.max(0,npc.pause-dt);
        npc.head.rotation.y=Math.sin(elapsed*1.4+npc.seed)*.24;
        if(npc.wheelchair)restoreWheelchair(npc);else npc.leftLeg.rotation.x=npc.rightLeg.rotation.x=npc.leftArm.rotation.x=npc.rightArm.rotation.x=0;
        continue;
      }
      const goal=npc.visit || npc.route[npc.target], dx=goal.x-p.x, dz=goal.z-p.z, distance=Math.hypot(dx,dz);
      if(distance<.08) {
        if(npc.visit) {enterVisit(npc);continue;}
        const corner=npc.target;npc.target=(npc.target+npc.direction+4)%4;
        if(npc.protester)continue;
        const choice=random(npc.seed*13+Math.floor(elapsed*3));
        if(choice>.8 && (corner===0||corner===1) && beginBuildingVisit(npc))continue;
        if(choice>.57 && choice<=.8) {
          const nearby=cars.find(car=>!car.stuck&&!car.waiting&&!car.passenger&&car.hz<2 && Math.abs(car.group.position.x-p.x)<7.5 && Math.abs(car.group.position.z-p.z)<10);
          if(beginCarVisit(npc,nearby))continue;
        }
        if(choice>.72)npc.pause=.7+random(npc.seed+elapsed)*2.4;
        if(choice<.1){npc.direction*=-1;npc.target=(npc.target+2*npc.direction+4)%4;}
        continue;
      }
      const oldX=p.x,oldZ=p.z,step=Math.min(distance,npc.speed*dt*(waterAt(p.x,p.z)?.45:1));
      p.x+=dx/distance*step;p.z+=dz/distance*step;
      const localBuildings=buildingCells.get(`${Math.floor(p.x/40)},${Math.floor(p.z/40)}`) || [];
      const blockedByBuilding=localBuildings.some(b=>insideBuilding(p.x,p.z,b,Math.max(npc.hx,npc.hz)) && !insideBuilding(oldX,oldZ,b,Math.max(npc.hx,npc.hz)));
      if((!waterAt(oldX,oldZ) && waterAt(p.x,p.z)) || blockedByBuilding || actorBlocked(npc,oldX,oldZ,nearbyActors(grid,npc))) {
        p.x=oldX;p.z=oldZ;
        if(npc.visit){cancelVisit(npc);nearestRouteCorner(npc);}else{npc.target=(npc.target-npc.direction+4)%4;npc.direction*=-1;}
        npc.pause=.4+random(npc.seed+elapsed)*1.1;
      } else {
        if(npc.parkWalker && inPark(p.x,p.z))p.y=waterAt(p.x,p.z)?.floor ?? .1+parkElevation(p.x,p.z);
        npc.group.rotation.y=Math.atan2(-dx,-dz);npc.step+=step*8;
        const stride=Math.sin(npc.step)*.43;
        if(npc.wheelchair) {
          restoreWheelchair(npc);npc.leftArm.rotation.x=npc.rightArm.rotation.x=Math.sin(npc.step)*.25;
          for(const wheel of npc.wheelchair.wheels)wheel.rotateZ(step*2.5);
        } else {npc.leftLeg.rotation.x=stride;npc.rightLeg.rotation.x=-stride;npc.leftArm.rotation.x=-stride*.8;npc.rightArm.rotation.x=stride*.8;}
        npc.head.rotation.y=Math.sin(elapsed*.65+npc.seed)*.08;
      }
    }
    updateDogs(dt);updateLandmarks(dt);
    for(const bird of birds) {
      const t=elapsed*.28+bird.phase;
      bird.group.position.set(-30+Math.sin(t)*bird.radius,bird.height+Math.sin(t*2)*.7,bird.centerZ+Math.cos(t)*bird.radius);
      bird.group.rotation.y=Math.atan2(-Math.cos(t),Math.sin(t));
      const flap=Math.sin(elapsed*9+bird.phase)*.55;
      bird.wings[0].rotation.z=-flap;bird.wings[1].rotation.z=flap;
    }
    for(const boat of harborBoats)boat.position.z=-30+Math.sin(elapsed*.055)*38;
    for(const heli of helicopters) {
      const t=elapsed*.045+heli.phase;
      heli.group.position.set(Math.sin(t)*heli.radius,heli.height+Math.sin(t*1.7)*4,Math.cos(t)*heli.radius);
      heli.group.rotation.y=Math.atan2(-Math.cos(t),Math.sin(t));
      heli.rotor.rotation.y=elapsed*18;heli.tailRotor.rotation.x=elapsed*25;
    }
    for(const aircraft of highAircraft) {
      if(nuke?.hitAircraft.has(aircraft))continue;
      const t=elapsed*.07+aircraft.phase;
      aircraft.group.position.set(aircraft.x+Math.sin(t)*7,aircraft.height+Math.sin(t*.8)*3,aircraft.z+Math.cos(t)*6);
      if(aircraft.propeller)aircraft.propeller.rotation.z=elapsed*12;
    }
    if (!projectiles.length) return;
    scene.updateMatrixWorld(true);
    const targets=bombTargets();
    for(let i=projectiles.length-1;i>=0;i--) {
      const shot=projectiles[i], travel=60*dt; shot.life-=dt;
      raycaster.set(shot.mesh.position,shot.direction); raycaster.far=travel;
      const hits=raycaster.intersectObjects(targets,true);
      if(hits.length) { playEffect('splat',hits[0].point);splatter(hits[0]);flashReticle();scene.remove(shot.mesh);projectiles.splice(i,1); }
      else { shot.mesh.position.addScaledVector(shot.direction,travel); if(shot.life<=0){scene.remove(shot.mesh);projectiles.splice(i,1);} }
    }
  }
  function update(dt) {
    if(blackoutMode==='out') {blackout=Math.max(0,blackout-dt/1.2);blastBlackout.style.opacity=String(blackout);if(blackout===0)blackoutMode='';}
    elapsed+=dt;shockTime=Math.max(0,shockTime-dt);attackImmunity=Math.max(0,attackImmunity-dt);previous.copy(position); updateNuke(dt);updateRescue(dt);updateWorld(dt);
    feedbackTime=Math.max(0,feedbackTime-dt);
    playerImpact=Math.max(0,playerImpact-dt);
    wallCooldown=Math.max(0,wallCooldown-dt);wallContact=null;
    zipCooldown=Math.max(0,zipCooldown-dt);
    if(zipTime>0){zipTime=Math.max(0,zipTime-dt);if(zipTime===0 && !rope && !webGrab)showWeb(false);}
    let anchorStart=null,anchorEnd=null;
    if(rope) {
      anchorStart=rope.anchor.clone();anchorEnd=anchorStart.clone();
      if(rope.anchorObject) {
        rope.anchorObject.updateWorldMatrix(true,false);
        anchorEnd=rope.anchorObject.localToWorld(rope.localAnchor.clone());
      }
      if(!rope.anchorVelocity)rope.anchorVelocity=new THREE.Vector3();
      rope.anchorVelocity.copy(anchorEnd).sub(anchorStart).multiplyScalar(dt>0?1/dt:0);
    }
    const frameStart=position.clone(),wasGrounded=onGround,wasGliding=glideEngaged,input=movement(),fallSpeed=-velocity.y;
    updateChaos(dt);updateParticles(dt);updateBosses(dt);updateActivities(dt);slapCooldown=Math.max(0,slapCooldown-dt);slapAnimation=Math.max(0,slapAnimation-dt);screenShake=Math.max(0,screenShake-dt*2.5);updateMutators(dt);
    if(input.lengthSq())input.normalize();
    // Solve the swing in small steps so arcs and reeling stay stable at different frame rates.
    const steps=Math.max(1,Math.ceil(dt/(1/120))),step=dt/steps;
    for(let i=0;i<steps;i++) {
      previous.copy(position);
      if(nuke?.phase==='blast' && nuke.playerHit) {
        // The blast carries the player beyond the normal playable boundary until blackout.
        velocity.y-=12*step;position.addScaledVector(velocity,step);onGround=false;continue;
      }
      if(rope && anchorStart)rope.anchor.lerpVectors(anchorStart,anchorEnd,(i+1)/steps);
      const steering=input.clone();
      if(rope) {
        const offset=position.clone().add(new THREE.Vector3(0,1.3,0)).sub(rope.anchor);
        const length=offset.length();
        // Once the web is taut, steer along its arc rather than pushing through it.
        if(length>0 && length>=rope.length-.08) {
          const normal=offset.multiplyScalar(1/length);
          steering.addScaledVector(normal,-steering.dot(normal));
        }
      }
      const waterHere=waterAt(position.x,position.z),wading=waterHere && position.y<waterHere.surface+.25;
      const glideAllowed=keys.sprint && !onGround && !rope && !webGrab && zipTime<=0 && !wading;
      const glideSpeed=Math.hypot(velocity.x,velocity.z);
      glideEngaged=Boolean(glideAllowed && glideSpeed>=(glideEngaged?12:16));
      const gliding=glideEngaged;
      if(gliding && glideSpeed>0) {
        const direction=new THREE.Vector3(velocity.x/glideSpeed,0,velocity.z/glideSpeed);
        // Bank sideways without applying an engine-like thrust along the flight path.
        steering.addScaledVector(direction,-steering.dot(direction));
      }
      const control=(onGround?(keys.sprint?64:32):rope?18:gliding?18:12)*(shockTime>0?.35:1)*(wading?.45:1);
      velocity.addScaledVector(steering,control*step);
      const drag=Math.exp(-(wading?5:onGround?4:rope?.05:gliding?0:.08)*step);
      velocity.x*=drag;velocity.z*=drag;
      if(onGround) {
        const horizontal=Math.hypot(velocity.x,velocity.z),limit=wading?3.5:keys.sprint?18:9;
        if(horizontal>limit){velocity.x*=limit/horizontal;velocity.z*=limit/horizontal;}
      }
      velocity.y-=(rope?24:18)*gravityScale*step;
      if(rope && keys.forward) {
        // Pumping on the downswing and through the bottom of the arc adds speed.
        const below=rope.anchor.y-position.y-1.3,relative=velocity.clone().sub(rope.anchorVelocity),speed=relative.length();
        if(below>rope.length*.35 && speed>3 && speed<42 && relative.y<1)velocity.addScaledVector(relative,7*step*Math.min(1,below/Math.max(rope.length,1)*1.3)/speed);
      }
      if(gliding) {
        // Lift acts perpendicular to the airflow; drag opposes it. Looking down
        // reduces angle of attack to trade altitude for speed, while pulling up
        // increases lift and drag until the wings stall at a steep angle.
        const airspeed=velocity.length(),horizontal=Math.hypot(velocity.x,velocity.z);
        if(airspeed>.01 && horizontal>.01) {
          const flightAngle=Math.atan2(velocity.y,horizontal);
          const angle=THREE.MathUtils.clamp(.12+pitch*.65-flightAngle,-.45,.8);
          const liftCoefficient=THREE.MathUtils.clamp(angle*2.4,-.55,1);
          const stall=1-THREE.MathUtils.smoothstep(Math.abs(angle),.38,.8)*.65;
          const lift=.036*airspeed*airspeed*liftCoefficient*stall;
          const airDirection=velocity.clone().multiplyScalar(1/airspeed);
          const liftDirection=new THREE.Vector3(-airDirection.x*airDirection.y/horizontal*airspeed,
            horizontal/airspeed,-airDirection.z*airDirection.y/horizontal*airspeed);
          velocity.addScaledVector(liftDirection,lift*step);
          const dragCoefficient=.0025+.0025*liftCoefficient*liftCoefficient;
          velocity.addScaledVector(airDirection,-Math.min(airspeed,dragCoefficient*airspeed*airspeed*step));
        }
      }
      if(rope && rope.anchor.y>position.y+.5 && position.y<14) {
        // Ease a dangerous low arc upward before impact, while the web has a higher anchor.
        const predictedHeight=position.y+Math.min(velocity.y,0)*.6-3.24;
        const danger=THREE.MathUtils.clamp((5-predictedHeight)/5,0,1);
        velocity.y+=Math.max(0,Math.min(42*danger,(4-velocity.y)*8))*step;
      }
      position.addScaledVector(velocity,step);
      if(rope) {
        rope.age+=step;
        const offset=position.clone().add(new THREE.Vector3(0,1.3,0)).sub(rope.anchor),length=offset.length();
        const oldLength=rope.length;
        // Shorten a web whose natural low point would pass through the street.
        const clearance=3+Math.min(3,Math.hypot(velocity.x,velocity.z)*.08);
        const safeLength=Math.max(2,rope.anchor.y-1.3-clearance);
        const danger=THREE.MathUtils.clamp((clearance-(rope.anchor.y-oldLength-1.3))/12,0,1);
        const proximity=THREE.MathUtils.clamp((25-position.y)/20,0,1);
        const reelBlend=THREE.MathUtils.smoothstep(rope.age,0,.45);
        const automatic=rope.anchor.y>position.y+.5?Math.min(18*danger*proximity*reelBlend*step,Math.max(0,oldLength-safeLength)):0;
        const tug=rope.age<.25 && !onGround?10*step:0;
        const reelAmount=Math.min(Math.max(automatic,tug,keys.sprint?9*step:0),Math.max(0,oldLength-2));
        rope.length-=reelAmount;
        if(length>0) {
          const normal=offset.multiplyScalar(1/length);
          if(reelAmount>0) {
            // Reeling a taut web preserves angular momentum and adds inward pull.
            if(length>=oldLength-.08) {
              const relative=velocity.clone().sub(rope.anchorVelocity);
              const tangent=relative.addScaledVector(normal,-relative.dot(normal));
              velocity.addScaledVector(tangent,oldLength/rope.length-1);
            }
            velocity.addScaledVector(normal,-14*step);
          }
          if(length>rope.length) {
            position.addScaledVector(normal,rope.length-length);
            const radialLimit=step>0?-reelAmount/step:0,radialSpeed=velocity.dot(normal)-rope.anchorVelocity.dot(normal);
            if(radialSpeed>radialLimit)velocity.addScaledVector(normal,radialLimit-radialSpeed);
          }
        }
      }
      const speed=velocity.length();
      const cap=gliding?72:50;if(!onGround && speed>cap)velocity.multiplyScalar(cap/speed);
      onGround=false;
      const wet=waterAt(position.x,position.z),groundHeight=wet?wet.floor:parkElevation(position.x,position.z);
      if(position.y<=groundHeight){position.y=groundHeight;velocity.y=Math.max(0,velocity.y);onGround=true;}
      for(const b of playerBuildingColliders) {
        if(position.y<(b.bottom||0)-.05)continue;
        const inside=insideBuilding(position.x,position.z,b,.4);
        if(!inside)continue;
        if((previous.y>=b.height || (b.walkable && previous.y>=b.height-.45)) && position.y<=b.height && velocity.y<=0){position.y=b.height;velocity.y=0;onGround=true;}
        else if(position.y<b.height && previous.y<b.height) {
          // Hold forward against a tall wall to climb briefly; jump pushes away.
          if(!onGround && !rope && keys.forward && !wallCooldown && wallRunTime<2.5 && b.height>10) {
            const wasInside=insideBuilding(previous.x,previous.z,b,.4);
            if(!wasInside) {
              const oldX=Math.abs(previous.x-b.x)<b.w/2+.4,oldZ=Math.abs(previous.z-b.z)<b.d/2+.4;
              const nx=!oldX?Math.sign(previous.x-b.x):0,nz=!oldZ?Math.sign(previous.z-b.z):0;
              const normal=new THREE.Vector3(nx,0,nz);
              if(normal.lengthSq()) {
                normal.normalize();wallContact=normal;wallRunTime+=step;
                velocity.y=Math.max(velocity.y,keys.sprint?9:5);
              }
            }
          }
          if(b.shape) {
            if(!insideBuilding(previous.x,previous.z,b,.4)){position.x=previous.x;position.z=previous.z;velocity.x=0;velocity.z=0;}
            continue;
          }
          const oldX=Math.abs(previous.x-b.x)<b.w/2+.4,oldZ=Math.abs(previous.z-b.z)<b.d/2+.4;
          if(!oldX){position.x=previous.x;velocity.x=0;}
          if(!oldZ){position.z=previous.z;velocity.z=0;}
        }
      }
      resolvePlayerActors();
      if(onGround){wallRunTime=0;wallContact=null;}
      position.x=THREE.MathUtils.clamp(position.x,worldMinX,worldMaxX);position.z=THREE.MathUtils.clamp(position.z,worldMinZ,worldMaxZ);
    }
    if(!wasGliding && glideEngaged)playEffect('glide');
    if(!wasGrounded && onGround && previous.y-position.y>.01) {
      playEffect('land');
      if(fallSpeed>20) {
        // Heavy landings kick up dust and shake the camera.
        impactFeedback(fallSpeed/14);playEffect('impact');burst(position.clone().setY(position.y+.2),30,[0xd8d0c4,0xb8b0a4],{speed:9,up:2,life:.9,gravity:3,size:.9,drag:3});
        if(fallSpeed>32)awardChaos(Math.round(fallSpeed*6),'SUPERHERO LANDING',null,'trick');
        for(const npc of pedestrians) {
          const q=npc.group.position,d=Math.hypot(q.x-position.x,q.z-position.z);
          if(d<7 && Math.abs(q.y-position.y)<2 && !npc.dead) {const away=new THREE.Vector3(q.x-position.x,0,q.z-position.z).normalize();throwActor(npc,away,false,away.multiplyScalar(14-d).add(new THREE.Vector3(0,8,0)));say(npc,'hit',.4);}
        }
      }
    }
    ambientSoundTime-=dt;
    if(ambientSoundTime<=0) {
      ambientSoundTime=4+Math.random()*5;
      const nearbyCar=cars.find(car=>car.group.visible && !car.stuck && car.group.position.distanceTo(position)<65);
      const nearbyBird=birds.find(bird=>bird.group.position.distanceTo(position)<65);
      if(nearbyBird && (!nearbyCar || Math.random()<.5))playEffect('bird',nearbyBird.group.position);
      else if(nearbyCar)playEffect('horn',nearbyCar.group.position);
    }
    footstepTime-=dt;
    if(onGround && input.lengthSq() && Math.hypot(velocity.x,velocity.z)>2 && footstepTime<=0) {
      playEffect('step');footstepTime=keys.sprint?.27:.4;
    }
    distance+=position.distanceTo(frameStart);
    const speed=Math.hypot(velocity.x,velocity.z);
    updateSceneDetail();updateCityLod(dt);
    const playerWater=waterAt(position.x,position.z);
    wadeRipple.visible=Boolean(playerWater && position.y<playerWater.surface+.25);
    if(wadeRipple.visible){wadeRipple.position.set(position.x,playerWater.surface+.015,position.z);wadeRipple.scale.setScalar(1+Math.min(speed/10,.5)+.08*Math.sin(elapsed*5));}
    updateSpeedBlur(velocity.length(),dt);
    const bob=onGround?Math.sin(elapsed*(8+speed*.2))*Math.min(speed/18,1)*.045:0;
    const lateral=velocity.x*Math.cos(yaw)-velocity.z*Math.sin(yaw);
    const blastShake=nuke?.phase==='blast'?Math.max(0,1-nuke.time/5):0;
    let ropeLean=0;
    if(rope) {
      // Lean the view toward the web anchor, more as the swing speeds up.
      const ax=rope.anchor.x-position.x,az=rope.anchor.z-position.z,side=ax*Math.cos(yaw)-az*Math.sin(yaw);
      ropeLean=-THREE.MathUtils.clamp(side/Math.max(8,Math.hypot(ax,az)),-1,1)*.16*Math.min(1,velocity.length()/25);
    }
    const targetRoll=(onGround?-lateral*.0015:THREE.MathUtils.clamp(-lateral*.0035,-.095,.095))+ropeLean + Math.sin(elapsed*14)*Math.min(playerImpact,1)*.24+Math.sin(elapsed*19)*blastShake*.07;
    cameraRoll+=(targetRoll-cameraRoll)*(1-Math.exp(-4*dt));
    const targetFov=72+Math.min(velocity.length()/52,1)*18+(rope?3:0)-(slowMotion?6:0);
    camera.fov+=(targetFov-camera.fov)*(1-Math.exp(-3*dt));camera.updateProjectionMatrix();
    let spinRoll=0;
    if(trickSpin>0) {
      // A barrel roll after a web launch.
      trickSpin+=dt/.7;if(trickSpin>=1||onGround)trickSpin=0;
      const t=trickSpin;spinRoll=trickDirection*Math.PI*2*(t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2);
    }
    const shake=screenShake*screenShake*.35;
    camera.position.set(position.x+(Math.random()-.5)*shake,position.y+1.7+bob+(Math.random()-.5)*shake,position.z+(Math.random()-.5)*shake); camera.rotation.set(pitch,yaw,cameraRoll+spinRoll,'YXZ');
    handBlend+=(Number(Boolean(rope||webGrab||zipTime))-handBlend)*(1-Math.exp(-9*dt));
    const sway=Math.sin(elapsed*7)*Math.min(speed/25,1)*.025;
    const running=onGround&&!rope&&!webGrab?Math.min(speed/9,1):0;
    runBlend+=(running-runBlend)*(1-Math.exp(-10*dt));
    runPhase+=dt*(7+Math.min(speed,18)*.48);
    const stride=Math.sin(runPhase)*runBlend, lift=Math.cos(runPhase*2)*runBlend;
    bombAnimation=Math.max(0,bombAnimation-dt);
    const shot=Math.sin(Math.PI*(1-bombAnimation/.38))*(bombAnimation>0?1:0);
    rightHand.position.set(.47-handBlend*.16+sway-stride*.035-shot*.13,-.59+handBlend*.25+bob+stride*.10+lift*.025+shot*.15,-1.0-handBlend*.08+stride*.13-shot*.28);
    rightHand.rotation.set(-handBlend*.28+velocity.y*.002-stride*.20-shot*.32,shot*.08,handBlend*.12-cameraRoll*.5-stride*.07);
    leftHand.position.set(-.47+sway+stride*.035,-.59+bob*1.5+(rope?.06:0)-stride*.10+lift*.025,-1.0-stride*.13);
    leftHand.rotation.set((rope?-.2:0)+stride*.20,0,-cameraRoll*.5+stride*.07);
    if(slapAnimation>0) {
      // Backhand sweep across the view.
      const t=1-slapAnimation/.3,swingArc=Math.sin(Math.PI*t);
      leftHand.position.x+=.75*t-.15;leftHand.position.y+=.25*swingArc;leftHand.position.z-=.35*swingArc;leftHand.rotation.z-=1.1*swingArc;leftHand.rotation.y-=.6*swingArc;
    }
    const glideActive=glideEngaged && !onGround && !rope && !webGrab && !(nuke?.phase==='blast'&&nuke.playerHit);
    glideBlend+=(Number(glideActive)-glideBlend)*(1-Math.exp(-(glideActive?7:12)*dt));
    glideWings.visible=glideBlend>.02;wingFilm.opacity=.13*glideBlend;wingThread.opacity=.65*glideBlend;
    for(const [hand,side] of [[leftHand,-1],[rightHand,1]]) {
      hand.position.lerp(new THREE.Vector3(side*.76,-.43,-1.18),glideBlend);
      hand.rotation.z+=side*.24*glideBlend;
    }
    swingPose+=(Number(Boolean(rope))-swingPose)*(1-Math.exp(-7*dt));
    // Bring the two fingertips to either side of the same grip point. The web
    // starts at the right fingertip, so the visual tether stays on the hands.
    for(const [hand,side] of [[leftHand,-1],[rightHand,1]]) {
      const grip=new THREE.Vector3(side*.065,-.18,-1.24);
      const tipOffset=hand.userData.fingertip.clone().applyEuler(hand.rotation);
      hand.position.lerp(grip.sub(tipOffset),swingPose);
    }
    if(glideWings.visible)for(const panel of wingPanels) {
      const hand=panel.side<0?leftHand:rightHand;hand.updateWorldMatrix(true,false);
      const elbow=hand.localToWorld(hand.userData.wingElbow.clone()),wrist=hand.localToWorld(hand.userData.wingWrist.clone());
      const innerBottom=new THREE.Vector3(panel.side*.16,-.84,-1.02),innerTop=new THREE.Vector3(panel.side*.27,-.64,-1.25);
      const outer=[],inner=[],middle=[],positions=panel.filmGeometry.attributes.position,threads=panel.lineGeometry.attributes.position;
      for(let i=0;i<=6;i++) {
        const t=i/6,a=elbow.clone().lerp(wrist,t),b=innerBottom.clone().lerp(innerTop,t);
        b.y-=.025*Math.sin(t*Math.PI*6);outer.push(a);inner.push(b);middle.push(a.clone().lerp(b,.55));
        positions.setXYZ(i*2,a.x,a.y,a.z);positions.setXYZ(i*2+1,b.x,b.y,b.z);
      }
      let n=0;const line=(a,b)=>{threads.setXYZ(n++,a.x,a.y,a.z);threads.setXYZ(n++,b.x,b.y,b.z);};
      for(let i=0;i<=6;i++)line(outer[i],inner[i]);
      for(let i=0;i<6;i++){line(outer[i],outer[i+1]);line(inner[i],inner[i+1]);line(middle[i],middle[i+1]);}
      positions.needsUpdate=true;threads.needsUpdate=true;
    }
    let risingSwing=0;
    if(rope && rope.age>.15) {
      const radial=position.clone().add(new THREE.Vector3(0,1.3,0)).sub(rope.anchor);
      const relative=velocity.clone().sub(rope.anchorVelocity);
      const tangentY=relative.y-radial.y*relative.dot(radial)/Math.max(radial.lengthSq(),.001);
      risingSwing=THREE.MathUtils.smoothstep(tangentY,.5,4);
    }
    footPose+=(risingSwing-footPose)*(1-Math.exp(-(risingSwing>footPose?6:12)*dt));
    swingLegs.visible=footPose>.03;
    swingLegs.position.set(0,-1.60+footPose*.62,-1.65);
    const kick=Math.sin(elapsed*3.5)*.045*Math.min(speed/20,1);
    boots[0].rotation.x=kick;boots[1].rotation.x=-kick;
    if (rope) {
      const hand=handWorldPosition();
      const separation=hand.distanceTo(rope.anchor), slack=Math.max(0,rope.length-separation);
      const extension=Math.min(1,rope.age/.13);
      webLines.forEach((line,strand)=>{
        const coords=line.geometry.attributes.position;
        for(let i=0;i<=24;i++) {
          const t=i/24*extension, wave=Math.sin(Math.PI*t), twist=t*20+strand*2.094+elapsed*1.5;
          const braid=(strand===0?0:.016)*wave;
          coords.setXYZ(i,hand.x+(rope.anchor.x-hand.x)*t+Math.cos(twist)*braid,
            hand.y+(rope.anchor.y-hand.y)*t-Math.min(slack*.12,.55)*wave+Math.sin(twist)*braid,
            hand.z+(rope.anchor.z-hand.z)*t+Math.sin(twist)*braid);
        }
        coords.needsUpdate=true; line.geometry.computeBoundingSphere();
      });
      anchorMarker.position.copy(rope.anchor);anchorMarker.scale.setScalar(1+.18*Math.sin(elapsed*8));
    } else if(zipTime>0 && zipAnchor) {
      const hand=handWorldPosition();
      for(const line of webLines) {
        const coords=line.geometry.attributes.position;
        for(let i=0;i<=24;i++){const t=i/24;coords.setXYZ(i,hand.x+(zipAnchor.x-hand.x)*t,hand.y+(zipAnchor.y-hand.y)*t,hand.z+(zipAnchor.z-hand.z)*t);}
        coords.needsUpdate=true;line.geometry.computeBoundingSphere();
      }
    } else if(webGrab) {
      const hand=handWorldPosition(),end=webGrab.group.position.clone().add(new THREE.Vector3(0,webGrab.top*.5,0));
      webLines.forEach((line,strand)=>{
        const coords=line.geometry.attributes.position;
        for(let i=0;i<=24;i++) {
          const t=i/24,wave=Math.sin(Math.PI*t),twist=t*20+strand*2.094+elapsed*1.5,braid=(strand===0?0:.016)*wave;
          coords.setXYZ(i,hand.x+(end.x-hand.x)*t+Math.cos(twist)*braid,hand.y+(end.y-hand.y)*t-.15*wave+Math.sin(twist)*braid,hand.z+(end.z-hand.z)*t+Math.sin(twist)*braid);
        }
        coords.needsUpdate=true;line.geometry.computeBoundingSphere();
      });
    }
    if(webRibbon.visible)updateWebRibbon();
    previewTimer-=dt;
    if(rope||webGrab||zipTime>0){anchorPreview.visible=false;}
    else if(previewTimer<=0) {
      previewTimer=.1;camera.updateMatrixWorld();const hit=findAnchor(0,0);
      anchorPreview.visible=Boolean(hit);if(hit)anchorPreview.position.copy(hit.point);reticle?.classList.toggle('targeted',Boolean(hit));
    }
    if(windGain) {
      const rush=THREE.MathUtils.smoothstep(velocity.length(),8,62);
      windGain.gain.setTargetAtTime(rush*.28,soundContext.currentTime,.12);windFilter.frequency.setTargetAtTime(220+rush*1300,soundContext.currentTime,.12);
    }
    updatePopups(dt);updateSpeedLines(dt,velocity.length());
    if(reticle) {reticle.classList.toggle('active',Boolean(rope||webGrab));reticle.classList.toggle('missed',feedbackTime>0);}
    sky.position.copy(camera.position);sky.material.uniforms.altitude.value=position.y; sun.position.set(position.x-60,position.y+100,position.z+40); sun.target.position.copy(position); sun.target.updateMatrixWorld();
  }
  // A cached north-up city map, with only moving markers redrawn each frame.
  const minimap=document.getElementById('minimap'),mapContext=minimap.getContext('2d');
  const mapScale=320/516,mapMinX=worldMinX-60,mapMinZ=worldMinZ-60;
  const mapX=x=>(x-mapMinX)*mapScale, mapY=z=>(z-mapMinZ)*mapScale;
  const mapBase=document.createElement('canvas');mapBase.width=Math.ceil((worldMaxX+60-mapMinX)*mapScale);mapBase.height=Math.ceil((worldMaxZ+60-mapMinZ)*mapScale);
  const mapPaint=mapBase.getContext('2d');
  const mapRect=(x0,z0,x1,z1)=>mapPaint.fillRect(mapX(x0),mapY(z0),(x1-x0)*mapScale,(z1-z0)*mapScale);
  mapPaint.fillStyle='#2d5164';mapPaint.fillRect(0,0,mapBase.width,mapBase.height);
  mapPaint.fillStyle='#46534f';mapRect(-1600,-1600,-430,1700);mapRect(430,-1600,1600,380);mapRect(brooklyn.maxX,brooklyn.minZ,1600,brooklyn.maxZ);
  mapPaint.fillStyle='#34434a';mapRect(-262,manhattanMinZ,262,manhattanMaxZ);mapRect(brooklyn.minX,brooklyn.minZ,brooklyn.maxX,brooklyn.maxZ);
  mapPaint.strokeStyle='#64747a';mapPaint.lineWidth=5.5;
  const mapLine=(x0,z0,x1,z1)=>{mapPaint.beginPath();mapPaint.moveTo(mapX(x0),mapY(z0));mapPaint.lineTo(mapX(x1),mapY(z1));mapPaint.stroke();};
  for(let x=-240;x<=240;x+=40)mapLine(x,manhattanMinZ,x,940);
  for(let z=-680;z<=920;z+=40)mapLine(-262,z,262,z);
  for(let x=360;x<=760;x+=40)mapLine(x,brooklyn.minZ,x,1060);
  for(let z=440;z<=1040;z+=40)mapLine(brooklyn.minX,z,brooklyn.maxX,z);
  mapPaint.fillStyle='#2d5164';mapRect(229,-80,262,80);
  mapPaint.fillStyle='#84908c';
  for(let gx=-5;gx<=5;gx+=2)for(let gz=-6;gz<21;gz++) {
    const x=gx*40,z=gz*40+20;
    if(joinedBlock(x,z))mapPaint.fillRect(mapX(x-5.6),mapY(z-14.5),11.2*mapScale,29*mapScale);
  }
  mapPaint.fillStyle='#293941';
  for(const b of buildings)mapPaint.fillRect(mapX(b.x-b.w/2),mapY(b.z-b.d/2),b.w*mapScale,b.d*mapScale);
  mapPaint.fillStyle='#496d52';mapRect(parkBounds.minX,parkBounds.minZ,parkBounds.maxX,parkBounds.maxZ);mapRect(-262,942,262,manhattanMaxZ);
  mapPaint.fillStyle='#b9a77a';mapRect(brooklyn.minX,1064,brooklyn.maxX,brooklyn.maxZ);
  mapPaint.strokeStyle='#809097';mapPaint.lineWidth=5;
  for(const road of curvedRoads) {
    mapPaint.beginPath();road.samples.forEach((p,i)=>i?mapPaint.lineTo(mapX(p.x),mapY(p.z)):mapPaint.moveTo(mapX(p.x),mapY(p.z)));mapPaint.stroke();
  }
  mapPaint.strokeStyle='#c7b48e';mapPaint.lineWidth=4;mapLine(150,bridgeZ,440,bridgeZ);
  function mapLabel(ctx,label,x,z,color='#f4f0df') {
    ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
    const w=ctx.measureText(label).width+8,px=THREE.MathUtils.clamp(mapX(x),w/2,mapBase.width-w/2),py=THREE.MathUtils.clamp(mapY(z),7,mapBase.height-7);ctx.fillStyle='rgba(15,29,34,.86)';ctx.fillRect(px-w/2,py-7,w,14);
    ctx.fillStyle=color;ctx.fillText(label,px,py);
  }
  for(const [label,x,z] of [['HARLEM',0,-470],['UPPER WEST SIDE',-170,-60],['UPPER EAST SIDE',140,-140],['CENTRAL PARK',-20,0],['MIDTOWN',-150,330],['TIMES SQ',60,220],['EMPIRE STATE',60,300],
    ['CHRYSLER',140,260],['FLATIRON',20,460],['THE VILLAGE',-120,560],['WASHINGTON SQ',20,540],['FINANCIAL DISTRICT',40,800],['WORLD TRADE',-160,700],['BATTERY PARK',0,970],['WATERFRONT',211,-26],
    ['BROOKLYN BRIDGE',300,bridgeZ-14],['DUMBO',430,790],['DOWNTOWN BROOKLYN',480,520],['BROOKLYN',640,900],['CONEY ISLAND',600,1085],['SCHOOL',-180,-20],['HOSPITAL',140,20],['BANK',-140,140],['GROCERY',140,140]])mapLabel(mapPaint,label,x,z);
  for(const [label,x,z] of [['HUDSON RIVER',-300,200],['EAST RIVER',310,100],['NEW JERSEY',-480,400],['QUEENS',560,-200],['UPPER BAY',100,1060]])mapLabel(mapPaint,label,x,z,'#9fd0e4');
  function drawMinimap(dt) {
    mapTimer-=dt;if(mapTimer>0)return;mapTimer=.08;
    const offsetX=160-mapX(position.x),offsetY=160-mapY(position.z);
    mapContext.fillStyle='#365e70';mapContext.fillRect(0,0,320,320);
    mapContext.drawImage(mapBase,offsetX,offsetY);
    mapContext.fillStyle='#81776a';
    for(const b of destructibleBuildings)if(b.destroyed)mapContext.fillRect(mapX(b.x-b.w/2)+offsetX,mapY(b.z-b.d/2)+offsetY,b.w*mapScale,b.d*mapScale);
    // Active villains show on the map, pinned to its edge when out of range.
    for(const boss of bosses) {
      if(boss.status!=='active')continue;
      const p=boss.actor.group.position,color=`#${boss.color.toString(16).padStart(6,'0')}`;
      const x=THREE.MathUtils.clamp(mapX(p.x)+offsetX,14,306),y=THREE.MathUtils.clamp(mapY(p.z)+offsetY,14,306);
      mapContext.fillStyle=color;mapContext.strokeStyle='#170d10';mapContext.lineWidth=2;mapContext.beginPath();mapContext.arc(x,y,6,0,Math.PI*2);mapContext.fill();mapContext.stroke();
      mapContext.font='bold 10px Arial';mapContext.textAlign='center';mapContext.textBaseline='middle';
      const labelY=THREE.MathUtils.clamp(y-14,8,312),w=mapContext.measureText(boss.name).width+8,labelX=THREE.MathUtils.clamp(x,w/2+2,318-w/2);
      mapContext.fillStyle='rgba(30,14,18,.9)';mapContext.fillRect(labelX-w/2,labelY-7,w,14);mapContext.fillStyle=color;mapContext.fillText(boss.name,labelX,labelY);
    }
    if(rescue?.result==='active') {
      const p=rescue.actor.group.position;let x=THREE.MathUtils.clamp(mapX(p.x)+offsetX,12,308),y=THREE.MathUtils.clamp(mapY(p.z)+offsetY,12,308);
      const dx=x-160,dy=y-160,d=Math.hypot(dx,dy);if(d<20){x=160+(d?dx/d:0)*20;y=160+(d?dy/d:-1)*20;}
      mapContext.fillStyle='#ffc75e';mapContext.strokeStyle='#30231b';mapContext.lineWidth=2;
      mapContext.beginPath();mapContext.arc(x,y,8,0,Math.PI*2);mapContext.fill();mapContext.stroke();
      mapContext.fillStyle='#211914';mapContext.font='bold 13px Arial';mapContext.textAlign='center';mapContext.textBaseline='middle';mapContext.fillText('!',x,y+.5);
    }
    mapContext.save();mapContext.translate(160,160);mapContext.rotate(-yaw);
    mapContext.fillStyle='#fff';mapContext.strokeStyle='#17333e';mapContext.lineWidth=2;mapContext.beginPath();
    mapContext.moveTo(0,-8);mapContext.lineTo(5,6);mapContext.lineTo(0,3);mapContext.lineTo(-5,6);mapContext.closePath();mapContext.fill();mapContext.stroke();mapContext.restore();
  }
  let shadowTime=0;
  let paused=false,pointerWasLocked=false,relockOnResume=false,pointerUnlockTime=0;
  const pauseMenu=document.getElementById('pause-menu'),resumeButton=document.getElementById('resume-game');
  function setPaused(value,lockLost=false) {
    if(paused===value)return;
    paused=value;pauseMenu.hidden=!value;document.querySelector('.game-shell').classList.toggle('is-paused',value);
    if(value) {
      if(nukeMusic)nukeMusic.pause();if(nukeBoom)nukeBoom.pause();if(nukeScreams)nukeScreams.pause();if(nukeCrowdLayer)nukeCrowdLayer.pause();stopNukeFallSound();
      relockOnResume=lockLost || document.pointerLockElement===canvas;
      Object.keys(keys).forEach(key=>keys[key]=false);cancelWebGrab();swing(false);
      if(document.pointerLockElement===canvas)document.exitPointerLock();
      resumeButton.focus();
    } else {
      if(nuke && musicEnabled)playNukeMusic();
      if(nuke?.phase==='fall'){startNukeFallSound();playNukeCrowd();}
      if(nuke?.phase==='blast' && nukeBoom && !nukeBoom.ended && nukeBoom.currentTime>0)nukeBoom.play().catch(()=>{});
      canvas.focus({preventScroll:true});
      if(relockOnResume && canvas.requestPointerLock){const request=canvas.requestPointerLock();if(request?.catch)request.catch(()=>{});}
      relockOnResume=false;
    }
  }
  function frame(t) { const raw=Math.min((t-last)/1000||0,.033); last=t;if(paused){requestAnimationFrame(frame);return;} timeScale+=((slowMotion?.3:1)-timeScale)*(1-Math.exp(-10*raw));let dt=raw*timeScale;if(hitStop>0){hitStop-=raw;dt*=.06;} update(dt); drawMinimap(dt); shadowTime-=dt;if(shadowTime<=0){renderer.shadowMap.needsUpdate=true;shadowTime=.1;} renderer.clear(); renderer.render(scene,camera); renderer.clearDepth(); renderer.render(handsScene,handsCamera); requestAnimationFrame(frame); }
  const map={KeyW:'forward',ArrowUp:'forward',KeyS:'back',ArrowDown:'back',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
  window.addEventListener('keydown',e=>{ if(e.code==='Escape'){e.preventDefault();if(!e.repeat && !(paused && performance.now()-pointerUnlockTime<300))setPaused(!paused);return;} if(paused)return; if (map[e.code]) { e.preventDefault(); keys[map[e.code]]=true; } if(e.code==='KeyR'&&!e.repeat)reset(); if(e.code==='KeyE'&&!e.repeat)webZip(); if(e.code==='KeyN'&&!e.repeat)launchNuke(); if((e.code==='KeyF'||e.code==='KeyQ')&&!e.repeat)spiderSlap(); if(e.code==='KeyT'){slowMotion=true;document.querySelector('.game-shell').classList.add('slowmo');} if(e.code==='Space'){e.preventDefault();if(!e.repeat)jump();} if(e.code==='ShiftLeft'||e.code==='ShiftRight'){e.preventDefault();keys.sprint=true;} });
  window.addEventListener('keyup',e=>{ if(map[e.code])keys[map[e.code]]=false; if(e.code==='ShiftLeft'||e.code==='ShiftRight')keys.sprint=false; if(e.code==='KeyT'){slowMotion=false;document.querySelector('.game-shell').classList.remove('slowmo');} });
  window.addEventListener('blur',()=>{ Object.keys(keys).forEach(k=>keys[k]=false); cancelWebGrab();swing(false); });
  canvas.addEventListener('pointerdown',e=>{
    if(paused)return;
    e.preventDefault();
    if (e.pointerType==='mouse') {
      const locked=document.pointerLockElement===canvas;
      const rect=canvas.getBoundingClientRect();
      const x=locked?0:(e.clientX-rect.left)/rect.width*2-1, y=locked?0:1-(e.clientY-rect.top)/rect.height*2;
      if(e.button===0) beginWebAction(x,y); else if(e.button===2) fireBomb(x,y); else if(e.button===1) spiderSlap();
      if (!locked && canvas.requestPointerLock) canvas.requestPointerLock();
    }
    else { canvas.setPointerCapture(e.pointerId); }
  });
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('pointerup',e=>{if(!paused && e.pointerType==='mouse' && e.button===0){const locked=document.pointerLockElement===canvas,rect=canvas.getBoundingClientRect();endWebAction(locked?0:(e.clientX-rect.left)/rect.width*2-1,locked?0:1-(e.clientY-rect.top)/rect.height*2);}});
  document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas) { yaw-=e.movementX*.0025; pitch=THREE.MathUtils.clamp(pitch-e.movementY*.0025,-1.35,1.35); }});
  let touchX=0,touchY=0;
  canvas.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'){touchX=e.clientX;touchY=e.clientY;}});
  canvas.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse' && e.buttons){yaw-=(e.clientX-touchX)*.005;pitch=THREE.MathUtils.clamp(pitch-(e.clientY-touchY)*.005,-1.35,1.35);touchX=e.clientX;touchY=e.clientY;}});
  document.addEventListener('pointerlockchange',()=>{const locked=document.pointerLockElement===canvas;if(!locked && pointerWasLocked && !paused){pointerUnlockTime=performance.now();setPaused(true,true);}pointerWasLocked=locked;if(!locked && !paused){cancelWebGrab();swing(false);}});
  for (const id of ['forward','back','left','right','sprint','jump','swing','bomb','zip','slap']) {
    const button=document.getElementById(id);
    button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();button.setPointerCapture(e.pointerId);if(id==='jump')jump();else if(id==='swing')beginWebAction();else if(id==='bomb')fireBomb();else if(id==='zip')webZip();else if(id==='slap')spiderSlap();else keys[id]=true;});
    const release=e=>{e.stopPropagation();if(id==='swing'){if(e.type==='pointerup')endWebAction();else{cancelWebGrab();swing(false);}}else if(id!=='jump' && id!=='bomb' && id!=='zip' && id!=='slap')keys[id]=false;};
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  }
  nukeButton.addEventListener('pointerdown',event=>event.stopPropagation());
  nukeButton.addEventListener('click',event=>{event.stopPropagation();if(!paused)launchNuke();});
  resumeButton.addEventListener('click',()=>setPaused(false));
  window.addEventListener('resize',()=>{particleMaterial.uniforms.viewport.value=innerHeight*renderer.getPixelRatio();camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();handsCamera.aspect=camera.aspect;handsCamera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
  // Batch the static details added after the buildings were constructed too.
  batchBuildingDetails();
  // Keep distant actors interactive while rendering a low-cost silhouette.
  // Their existing child pivots remain intact inside an identity transform.
  const actorDetailGeometry=new THREE.CylinderGeometry(.32,.38,1,6),vehicleDetailGeometry=new THREE.BoxGeometry(1,1,1);
  const personDetailMaterial=new THREE.MeshLambertMaterial({color:0x646b70});
  const carDetailMaterial=new THREE.MeshLambertMaterial({color:0x697077}),taxiDetailMaterial=new THREE.MeshLambertMaterial({color:0xd5a536});
  const detailActors=[...cars,...pedestrians];
  for(const actor of detailActors) {
    const root=new THREE.Group();while(actor.group.children.length)root.add(actor.group.children[0]);actor.group.add(root);actor.visualRoot=root;
    const car=cars.includes(actor),proxy=new THREE.Mesh(car?vehicleDetailGeometry:actorDetailGeometry,car?(actor.modelKind==='taxi'?taxiDetailMaterial:carDetailMaterial):personDetailMaterial);
    proxy.scale.set(car?actor.hx*2:1,actor.top*.85,car?actor.hz*2:1);proxy.position.y=actor.top*.43;proxy.visible=false;proxy.raycast=()=>{};
    actor.group.add(proxy);actor.detailProxy=proxy;
  }
  const detailTrees=scene.children.filter(object=>object.userData.treeType).map(group=>{
    const trunk=group.children.find(child=>child.isMesh && child.geometry.type==='CylinderGeometry');
    const height=trunk?.geometry.parameters.height||5;
    const root=new THREE.Group();while(group.children.length)root.add(group.children[0]);group.add(root);return {group,root,height};
  });
  const distantTrunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.18,.24,1,6),bark,detailTrees.length);
  const distantCanopies=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),parkLeaves[1],detailTrees.length);
  for(const batch of [distantTrunks,distantCanopies]){batch.frustumCulled=false;batch.userData.projectile=true;batch.raycast=()=>{};scene.add(batch);}
  const detailTransform=new THREE.Object3D(),detailMatrix=new THREE.Matrix4(),hiddenDetail=new THREE.Matrix4().makeTranslation(0,-10000,0);
  function updateSceneDetail() {
    for(const actor of detailActors) {
      const p=actor.group.position,dx=p.x-position.x,dz=p.z-position.z,dy=(p.y-position.y)*.5;
      const detailed=dx*dx+dz*dz+dy*dy<100*100 || actor.webHeld || actor.webPinned || actor.knockback || rescue?.actor===actor;
      actor.visualRoot.visible=detailed;actor.detailProxy.visible=!detailed;
    }
    detailTrees.forEach((tree,index)=>{
      const p=tree.group.position,dx=p.x-position.x,dz=p.z-position.z;
      const distanceSq=dx*dx+dz*dz;tree.root.visible=distanceSq<90*90;
      if(distanceSq>=90*90 && distanceSq<240*240) {
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
        awardChaos(500,`GOLDEN PIZZA ${pizzaCollected.size}/${pizzaSpots.length}`,spot.clone(),'hero');
        worldPopup(pick(['Still warm?!','Pigeon-tested','Rooftop pizza hits different','Only slightly radioactive','Worth the climb','Grease = power']),spot.clone().setY(spot.y+1),'speech',2);
        if(pizzaCollected.size===pizzaSpots.length)showBreaking('ALL 40 GOLDEN PIZZAS FOUND. YOU ARE THE PIZZA RAT NOW.');
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
        awardChaos(medal==='GOLD'?3000:medal==='SILVER'?2000:medal==='BRONZE'?1200:300,`${medal} ${time.toFixed(1)}s`,raceRing.position.clone(),'hero');
        showBreaking(`${race.course.name}: ${time.toFixed(2)}s, ${medal}${record?' (NEW RECORD)':''}${medal==='PARTICIPATION'?'. YOUR MOM IS STILL PROUD.':''}`);
        burst(raceRing.position,80,confetti,{speed:14,up:8,life:1.8,size:.35});playEffect('success');
        raceRing.visible=raceNext.visible=false;race=null;raceCooldown=4;updateActivityHud();return;
      }
      placeRaceRings();
    }
    if(race.time>120 || keys.back && keys.forward){raceRing.visible=raceNext.visible=false;race=null;raceCooldown=3;showBreaking('RACE ABANDONED. NOBODY SAW. (EVERYONE SAW.)');return;}
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
    steamTimer-=dt;if(steamTimer>0)return;steamTimer=.08;
    for(const vent of steamVents)if(Math.abs(vent.x-position.x)<110 && Math.abs(vent.z-position.z)<110)
      burst(vent,1,[0xeef0f2,0xd8dcdf],{speed:.5,up:2.5,gravity:-.5,life:2.8,size:2.6,drag:.8,spread:.6});
  }
  function updateActivities(dt){updatePizza(dt);updateRaces(dt);updateGeysers(dt);updateSteam(dt);}
  // Distance LOD: city chunks beyond the detail radius move to a hidden layer and
  // their towers are drawn by a few instanced stand-ins, cutting draw calls sharply.
  const lodHiddenLayer=3,lodNear=300,lodCell=120,lodChunks=new Map(),lodProxies=[];
  {
    const dynamic=new Set([sky,anchorMarker,webRibbon,anchorPreview,particleSystem,wadeRipple,sun,sun.target,fill,rhino.group,distantTrunks,distantCanopies,roadMarks,
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
    const range=lodNear+Math.min(position.y,120)*.8;let changed=false;
    for(const chunk of lodChunks.values()) {
      const near=Math.hypot(chunk.x-position.x,chunk.z-position.z)<(chunk.small?115:range);
      if(near===chunk.near && !force)continue;
      chunk.near=near;changed=true;
      for(const object of chunk.objects)object.traverse(child=>{if(near)child.layers.enable(0);else child.layers.set(lodHiddenLayer);});
    }
    // Knockable props move, so they are culled by their own current position.
    for(const prop of chargeProps) {
      const p=prop.group.position,near=Boolean(prop.knockback) || (p.x-position.x)**2+(p.z-position.z)**2<115*115;
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
  // Opt-in test hook for automated playtesting: open the game with ?debug.
  if(new URLSearchParams(location.search).has("debug"))window.__spida={renderer,scene,grappleMeshes,buildings,position,velocity,keys,pedestrians,cars,mutators,beginWebAction,endWebAction,jump,spiderSlap,setMutator,
    look:(y,p)=>{yaw=y;pitch=p;},tick:(seconds,dt=1/60)=>{for(let t=0;t<seconds;t+=dt)update(dt);renderer.shadowMap.needsUpdate=true;renderer.clear();renderer.render(scene,camera);renderer.clearDepth();renderer.render(handsScene,handsCamera);drawMinimap(1);},state:()=>({rope:Boolean(rope),onGround,speed:velocity.length(),chaosScore,comboPoints,opinion,anchor:rope?.anchor})};
  reset();updateSceneDetail();updateCityLod(0,true);requestAnimationFrame(frame);
})();

