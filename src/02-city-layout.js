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
  const worldMinX=-258,worldMaxX=762,worldMinZ=-698,worldMaxZ=1275;
  // Repeating facade tiles retain a consistent window size across short and tall buildings.
  const facadeMaps=new Map(),facadeNightMaps=new Map(),nightFacades=[];
  function facadeMaterial(kind, tint) {
    const glassStyle=kind===2||kind===4;
    let texture=facadeMaps.get(kind);
    if(!texture) {
    const image=document.createElement('canvas'); image.width=512; image.height=1024;
    const c=image.getContext('2d');c.scale(2,2);
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
      c.fillStyle=glassStyle?'#344c57':kind===3?'#62483f':'#6b625a'; c.fillRect(x-2,y-2,w+4,h+5);
      c.fillStyle='rgba(15,25,28,.38)';c.fillRect(x,y,w,h);
      const glass=c.createLinearGradient(x,y,x+w,y+h);
      glass.addColorStop(0,variation>.5?'#8da7a8':'#78939b');
      glass.addColorStop(.52,variation>.45?'#526e7b':'#405e6c');glass.addColorStop(1,'#263f4d');
      c.fillStyle=variation>.95?'#c4ac82':glass; c.fillRect(x+1,y+1,w-2,h-2);
      // A faint sky reflection and varied blinds keep the glass from reading as a flat grid.
      c.fillStyle='rgba(224,235,226,.14)';c.beginPath();c.moveTo(x,y+h*.10);c.lineTo(x+w,y);c.lineTo(x+w,y+h*.24);c.lineTo(x,y+h*.38);c.fill();
      if(variation<.32){
        c.fillStyle='rgba(220,210,190,.30)';c.fillRect(x+2,y+2,w-4,h*(.22+variation));
        c.strokeStyle='rgba(61,70,71,.28)';c.lineWidth=.5;
        for(let blind=y+4;blind<y+h*(.22+variation);blind+=3){c.beginPath();c.moveTo(x+2,blind);c.lineTo(x+w-2,blind);c.stroke();}
      }
      c.fillStyle='rgba(220,235,234,.35)';c.fillRect(x+w*.49,y,1,h);
      c.fillStyle='rgba(240,243,231,.16)';c.fillRect(x+1,y+1,w-2,1);
      c.fillStyle='rgba(13,29,37,.35)';c.fillRect(x+1,y+h-2,w-2,2);
      if(!glassStyle) {
        c.fillStyle='rgba(217,225,220,.3)';c.fillRect(x,y+h*.53,w,1);
        c.fillStyle='rgba(245,235,217,.55)';c.fillRect(x-3,y+h+1,w+6,2);
        c.fillStyle='rgba(45,38,34,.25)';c.fillRect(x-3,y+h+3,w+6,2);
      }
    }
    texture=new THREE.CanvasTexture(image); texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    facadeMaps.set(kind,texture);
    }
    // A matching map of lit windows glows after dark.
    let night=facadeNightMaps.get(kind);
    if(!night) {
      const image=document.createElement('canvas');image.width=256;image.height=512;const c=image.getContext('2d');
      c.fillStyle='#000';c.fillRect(0,0,256,512);
      const cols=glassStyle?8:6,rows=16,dx=256/cols,dy=512/rows;
      for(let row=0;row<rows;row++)for(let col=0;col<cols;col++) {
        const lit=random(row*41+col*7+kind*13+5);if(lit<.66)continue;
        const x=col*dx+(glassStyle?3:6),y=row*dy+(glassStyle?3:5),w=dx-(glassStyle?6:12),h=dy-(glassStyle?6:10);
        c.fillStyle=lit>.93?'#a9d4ff':lit>.8?'#ffe0a8':'#ffc978';c.fillRect(x,y,w,h);
        if(lit<.7){c.fillStyle='rgba(0,0,0,.55)';c.fillRect(x,y,w,h*.45);}
      }
      night=new THREE.CanvasTexture(image);night.colorSpace=THREE.SRGBColorSpace;night.wrapS=night.wrapT=THREE.RepeatWrapping;facadeNightMaps.set(kind,night);
    }
    const facade=new THREE.MeshStandardMaterial({color:tint,map:texture,roughness:glassStyle?.30:.86,metalness:glassStyle?.24:.02,envMap:glassStyle?skyReflection:null,envMapIntensity:.58,emissive:0xffffff,emissiveMap:night,emissiveIntensity:0});
    nightFacades.push(facade);return facade;
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
  const buildingMats=[facadeMaterial(0,0xded8cb),facadeMaterial(1,0xcab9aa),facadeMaterial(2,0xc8d4d2),facadeMaterial(0,0xbeb6a9),facadeMaterial(3,0xffffff),facadeMaterial(4,0xe1eef2),facadeMaterial(3,0xdcb5a4),facadeMaterial(1,0xd5c9b3),facadeMaterial(2,0xaac5ce)];
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
        // A shaped tower and its matching roof use the same slot in separate batches.
        const roof=shape<0?roofs:shapedRoofs[shape],roofIndex=shape<0?roofCount++:towerIndex;
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
  const windowFrame=material(0xd6c9b4),storeInterior=material(0x9e8f78),storeShelf=material(0x5b483b),planterStone=material(0x81746a),planterLeaves=material(0x4b6d4e),roofPanel=material(0x304c58),roofTrim=material(0x798381);
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
        box(1.55,.18,.22,windowFrame,doorX,2.87,front+side*.12);
        for(const edge of [-1,1])box(.12,2.5,.2,windowFrame,doorX+edge*.71,1.65,front+side*.12);
        for(let step=0;step<3;step++)box(1.8,.18,.4,stone,doorX,.48+step*.18,front+side*(1.05-step*.32));
      }
      if(random(seed+side*81)>.46)for(const edge of [-1,1]) {
        box(2,.28,.48,planterStone,x+edge*8,3.8,front+side*.25);
        box(1.7,.28,.33,planterLeaves,x+edge*8,4.02,front+side*.28);
      }
      if(random(seed+side*41)>.5)waterTower(x+side*6-3,height+.95,bz);
      const building={x,z:bz,w:27,d:11,height:height+.95,rowHouse:true};buildings.push(building);grappleMeshes.push(tower,roof);
      registerDestructible(building,scene.children.slice(first),upperStart);
    }
  }
  const storefrontColors=[material(0x8e4038),material(0x38636c),material(0x526947),material(0x694863),material(0x725a3b)];
  const storefrontSigns=['CAFE','DELI','MARKET','PIZZA','BAKERY','BARBER','PHARMACY','LAUNDRY'].map((name,i)=>{
    const image=document.createElement('canvas');image.width=256;image.height=64;const ctx=image.getContext('2d');
    ctx.fillStyle=['#783d35','#315862','#475b41','#5d4059','#6c573a'][i%5];ctx.fillRect(0,0,256,64);
    ctx.strokeStyle='rgba(255,245,217,.6)';ctx.lineWidth=3;ctx.strokeRect(3,3,250,58);
    ctx.fillStyle='#fff2d7';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 36px sans-serif';ctx.fillText(name,128,34);
    const texture=new THREE.CanvasTexture(image);texture.colorSpace=THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({map:texture,roughness:.8});
  });
  function cityBlock(gx,gz) {
    const x=gx*40+20, z=gz*40+20, seed=(gx+9)*31+(gz+9)*73;
    // The northernmost blocks are reserved for the residential neighborhood.
    if(gx>=-5 && gx<5 && gz>=-17 && gz< -12)return;
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
    // Expansion joints remain with the sidewalk when a building collapses.
    for(const side of [-1,1])box(28.6,.015,.035,roofTrim,x,.435,z+side*12.2);
    const firstPart=scene.children.length,upperStart=upperBuildingColliders.length;
    const style=district==='dumbo'||district==='harlem'?6:Math.floor(random(seed+90)*11), value=random(seed);
    const baseHeight=Math.floor(style===0?14+value*10:style===1?25+value*30:style===2?62+value*48:style===3?42+value*38:style===5?46+value*32:style===6?20+value*18:style===7?65+value*45:style===8?55+value*42:style===9?44+value*38:style===10?30+value*30:24+value*42);
    // Each neighborhood has its own skyline: tall Midtown and FiDi, low brick elsewhere.
    const height=Math.floor(district==='uptown'?Math.min(baseHeight,20+value*34):district==='midtown'?Math.max(baseHeight,50+value*70):district==='village'||district==='harlem'?Math.min(baseHeight,14+value*24):
      district==='fidi'?Math.max(baseHeight,48+value*80):district==='dumbo'?16+value*16:district==='downtown-brooklyn'?Math.min(baseHeight,26+value*48):Math.min(baseHeight,14+value*20));
    const w=(style===2||style===7?16:19)+random(seed+1)*7, d=20+random(seed+2)*6;
    const shape=style===8?'round':style===9?'diamond':style===10?'octagon':null;
    let facade=district==='dumbo'||district==='harlem'?buildingMats[random(seed+106)>.5?4:6]:buildingMats[style===2?2:style===0?1:style===5?0:style===6?4:style===7||style===8||style===9?5:style===10?3:Math.floor(random(seed+4)*4)];
    if((district==='village'||district==='brooklyn') && random(seed+107)>.55)facade=buildingMats[random(seed+108)>.5?6:7];
    if((district==='midtown'||district==='fidi') && shape!=='round' && random(seed+109)>.8)facade=buildingMats[8];
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
      // Recesses, masonry bands and narrow fins give the facade actual depth.
      const modern=style===2||style===7,frame=modern?metal:stone;
      for(const side of [-1,1]) {
        box(.18,height-5,.24,frame,x+side*w*.46,(height+5)/2,z-d/2-.12);
        box(.24,height-5,.18,frame,x-w/2-.12,(height+5)/2,z+side*d*.46);
      }
      const bandStep=modern?12:8;
      for(let y=5+bandStep;y<height-2;y+=bandStep) {
        box(w+.25,.12,.24,frame,x,y,z-d/2-.10);
        box(.24,.12,d+.25,frame,x-w/2-.10,y,z);
      }
      if(!modern && height<58 && random(seed+221)>.72) {
        for(let y=9;y<Math.min(height-2,37);y+=8) {
          box(w*.42,.16,1.0,stone,x,y,z-d/2-.55);
          box(w*.42,.08,.08,metal,x,y+.9,z-d/2-1.02);
          for(let rail=-2;rail<=2;rail++)box(.045,.9,.045,metal,x+rail*w*.095,y+.46,z-d/2-1.02);
        }
      }
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
      if(height>12 && random(seed+191)>.48) {
        const accent=storefrontColors[Math.floor(random(seed+192)*storefrontColors.length)],width=Math.min(9,w*.58),front=z-d/2;
        box(width,.26,1.35,accent,x,4.15,front-.73);
        box(width,.38,.12,accent,x,3.98,front-1.4);
        const sign=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(6.5,width*.8),.92),storefrontSigns[Math.floor(random(seed+193)*storefrontSigns.length)]);
        sign.position.set(x,5.55,front-.14);sign.rotation.y=Math.PI;scene.add(sign);
        for(const side of [-1,1])box(.12,2.4,.15,accent,x+side*width*.48,1.7,front-.21);
        // A small display behind the shopfront makes it read as an occupied shop at street level.
        for(const side of [-1,1]) {
          const sx=x+side*width*.29;
          box(width*.32,1.85,.04,storeInterior,sx,2.23,front-.16);
          for(let shelf=0;shelf<3;shelf++)box(width*.3,.055,.10,storeShelf,sx,1.55+shelf*.52,front-.22);
          for(let item=0;item<3;item++)box(.18,.24,.09,storefrontColors[(item+Math.floor(random(seed+194)*5))%5],sx+(item-1)*width*.085,1.73,front-.27);
        }
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
      if(random(seed+210)>.43) {
        // Low solar panels and pipe runs give rooftops a more useful silhouette.
        for(let n=-1;n<=1;n++) {
          box(w*.14,.12,d*.22,roofPanel,x+n*w*.16,height+1.08,z+d*.28);
          box(w*.15,.08,.12,roofTrim,x+n*w*.16,height+1.17,z+d*.17);
        }
        box(w*.52,.12,.12,roofTrim,x,height+1.15,z-d*.30);
      }
      if(random(seed+222)>.55) {
        for(const side of [-1,1]) {
          box(.09,1,.09,metal,x+side*w*.38,height+1.45,z+d*.38);
          box(.09,1,.09,metal,x+side*w*.38,height+1.45,z-d*.38);
          box(.08,.08,d*.76,metal,x+side*w*.38,height+1.95,z);
        }
        box(w*.76,.08,.08,metal,x,height+1.95,z+d*.38);
        box(w*.76,.08,.08,metal,x,height+1.95,z-d*.38);
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
    box(400,.08,200,lawn,0,.04,-580).receiveShadow=true;
    for(let x=-200;x<=200;x+=40)box(10,.03,200,mats.road,x,.10,-580);
    for(let z=-680;z<=-480;z+=40)box(400,.03,10,mats.road,0,.12,z);
    const roofShape=new THREE.Shape();roofShape.moveTo(-5,0);roofShape.lineTo(5,0);roofShape.lineTo(0,3);roofShape.closePath();
    const roofGeometry=new THREE.ExtrudeGeometry(roofShape,{depth:14,bevelEnabled:false});
    const windows=new THREE.MeshStandardMaterial({color:0x647f88,roughness:.35,metalness:.12});
    for(let gx=-5;gx<5;gx++)for(let gz=-17;gz< -12;gz++)for(const side of [-1,1]) {
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
  makeSuburbs();
  const playerBuildingColliders=buildings.concat(upperBuildingColliders);
  // Populated after landmarks are built so traversal only checks nearby geometry.
  const playerColliderCells=new Map(),movingColliders=[];
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
