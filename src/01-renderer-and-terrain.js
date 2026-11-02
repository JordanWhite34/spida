(() => {
  'use strict';
  if (typeof THREE === 'undefined') { document.getElementById('error').hidden = false; return; }
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const graphicsProfiles={performance:{label:'Performance',pixelRatio:.85,detail:.75,shadowInterval:.22},balanced:{label:'Balanced',pixelRatio:1.25,detail:1,shadowInterval:.1},high:{label:'High',pixelRatio:1.75,detail:1.2,shadowInterval:.08}};
  let graphicsQuality='balanced';try{const saved=localStorage.getItem('spida.graphics');if(graphicsProfiles[saved])graphicsQuality=saved;}catch(_){}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,graphicsProfiles[graphicsQuality].pixelRatio));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  renderer.autoClear = false;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb3ccd9);
  scene.fog = new THREE.Fog(0xb6c9d0, 260, 1150);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { altitude: { value: 0 }, uSun: { value: new THREE.Vector3(-.48,.8,.32) }, uNight: { value: 0 }, uDusk: { value: 0 }, uOvercast: { value: 0 }, uTime: { value: 0 } },
    vertexShader: 'varying vec3 vPosition; void main() { vPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      varying vec3 vPosition;
      uniform float altitude,uNight,uDusk,uOvercast,uTime;
      uniform vec3 uSun;
      float hash(vec2 p) { return fract(sin(dot(p,vec2  (127.1,311.7)))*43758.5453); }
      float noise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+1.0),f.x),f.y);
      }
      void main() {
        vec3 dir=normalize(vPosition); float h=dir.y;
        vec3 col=mix(vec3(.78,.76,.72),vec3(.18,.39,.61),smoothstep(-.08,.78,h));
        // Sunset warms the horizon and purples the upper sky.
        col=mix(col,mix(vec3(1.0,.55,.3),vec3(.33,.27,.5),smoothstep(-.05,.55,h)),uDusk*.75);
        col=mix(col,vec3(.91,.76,.65),exp(-abs(h-.04)*11.0)*.24*(1.0-uNight));
        vec3 sun=normalize(uSun); float d=max(dot(dir,sun),0.0);
        col+=(vec3(.32,.22,.13)*pow(d,12.0)+vec3(.65,.51,.34)*pow(d,700.0))*(1.0-uNight)*(1.0-uOvercast*.8);
        // Night: deep blue with a city glow along the horizon, a moon and stars.
        vec3 night=mix(vec3(.02,.03,.06),vec3(.05,.08,.16),smoothstep(-.1,.6,h))+vec3(.09,.06,.03)*exp(-abs(h)*9.0);
        col=mix(col,night,uNight);
        float m=max(dot(dir,-sun),0.0);col+=(vec3(.85,.88,.95)*pow(m,2500.0)*2.0+vec3(.08,.1,.16)*pow(m,24.0))*uNight*(1.0-uOvercast);
        vec2 sp=dir.xz/max(h+.05,.05)*240.0;float star=step(.9978,hash(floor(sp)))*smoothstep(.04,.3,h);
        col+=vec3(star)*uNight*(1.0-uOvercast)*(.55+.45*sin(uTime*3.0+sp.x));
        vec2 p=dir.xz/max(h+.22,.12)*1.6+vec2(uTime*.004,0.0);
        float cloud=noise(p)*.53+noise(p*2.07)*.27+noise(p*4.13)*.13+noise(p*8.2)*.06;
        float mask=smoothstep(.50-.32*uOvercast,.72,cloud)*smoothstep(.015,.17,h)*(1.0-smoothstep(.75,.98,h));
        vec3 cloudColor=mix(mix(vec3(.94,.92,.87),vec3(.98,.68,.52),uDusk*.6),vec3(.42,.44,.48),uOvercast)*mix(1.0,.1,uNight);
        col=mix(col,cloudColor,mask*(.48+.4*uOvercast));
        col=mix(col,vec3(.56,.59,.62)*mix(1.0,.1,uNight),uOvercast*.5);
        col=mix(col,col*vec3(.15,.22,.42),smoothstep(250.0,750.0,altitude));
        gl_FragColor=vec4(col,1.0);
      }`
  })); scene.add(sky);
  // A soft skyline reflection gives glass and painted metal a believable environment.
  const reflectionCanvas=document.createElement('canvas');reflectionCanvas.width=1024;reflectionCanvas.height=512;
  {
    const c=reflectionCanvas.getContext('2d'),gradient=c.createLinearGradient(0,0,0,512);
    gradient.addColorStop(0,'#4d7897');gradient.addColorStop(.42,'#a3bbc2');gradient.addColorStop(.50,'#d7c9b3');gradient.addColorStop(.54,'#667b80');gradient.addColorStop(1,'#364c53');
    c.fillStyle=gradient;c.fillRect(0,0,1024,512);
    c.fillStyle='rgba(55,79,88,.25)';
    for(let i=0;i<80;i++){const x=i*14,w=8+(i*17%14),h=10+(i*37%58);c.fillRect(x,274-h,w,h);}
    const glow=c.createRadialGradient(220,165,2,220,165,95);glow.addColorStop(0,'rgba(255,244,220,.85)');glow.addColorStop(1,'rgba(255,231,205,0)');c.fillStyle=glow;c.fillRect(100,45,240,240);
  }
  const skyReflection=new THREE.CanvasTexture(reflectionCanvas);skyReflection.colorSpace=THREE.SRGBColorSpace;skyReflection.mapping=THREE.EquirectangularReflectionMapping;
  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .3, 1300);
  camera.rotation.order='YXZ';
  const hemi=new THREE.HemisphereLight(0xd9edff, 0x81796d, 1.38);scene.add(hemi);
  const fill=new THREE.DirectionalLight(0xaac8dd,.55);fill.position.set(80,55,-90);scene.add(fill);
  const sun = new THREE.DirectionalLight(0xffe3c4, 3.15); sun.position.set(-60, 100, 40); sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048); Object.assign(sun.shadow.camera,{left:-85,right:85,top:85,bottom:-85,near:1,far:300});
  sun.shadow.bias=-0.0003; sun.shadow.normalBias=.04; scene.add(sun); scene.add(sun.target);
  const material = color => new THREE.MeshStandardMaterial({ color, roughness: .88 });
  const mats = { road: material(0x4e5960), sidewalk: material(0xb8b5a9), line: material(0xf4e9c6), red: material(0xc93434), blue: material(0x243e74), dark: material(0x1f2633), white: material(0xf7f4e9), roof: material(0x536268) };
  const box = (w,h,d,mat,x,y,z,parent=scene) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); mesh.position.set(x,y,z); parent.add(mesh); return mesh; };
  const random = n => { const v = Math.sin(n * 127.1 + 17.7) * 43758.5453; return v - Math.floor(v); };
  const concreteCanvas=document.createElement('canvas');concreteCanvas.width=concreteCanvas.height=512;
  {
    const c=concreteCanvas.getContext('2d');c.fillStyle='#eeeeea';c.fillRect(0,0,512,512);
    for(let i=0;i<14000;i++) {
      const x=random(i*13+2)*512,y=random(i*17+3)*512;
      c.fillStyle=i%3?'rgba(78,74,68,.08)':'rgba(255,255,255,.23)';c.fillRect(x,y,1+(i%2),1+(i%2));
    }
    c.strokeStyle='rgba(85,82,75,.23)';c.lineWidth=2;
    for(let i=0;i<=512;i+=128){c.beginPath();c.moveTo(i,0);c.lineTo(i,512);c.moveTo(0,i);c.lineTo(512,i);c.stroke();}
    c.strokeStyle='rgba(255,255,255,.30)';c.lineWidth=1;
    for(let i=0;i<512;i+=128){c.beginPath();c.moveTo(i+2,0);c.lineTo(i+2,512);c.moveTo(0,i+2);c.lineTo(512,i+2);c.stroke();}
  }
  const concreteTexture=new THREE.CanvasTexture(concreteCanvas);concreteTexture.colorSpace=THREE.SRGBColorSpace;concreteTexture.wrapS=concreteTexture.wrapT=THREE.RepeatWrapping;concreteTexture.repeat.set(4,4);
  concreteTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());mats.sidewalk.map=concreteTexture;mats.sidewalk.bumpMap=concreteTexture;mats.sidewalk.bumpScale=.012;
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
    // The little island is real ground; the surrounding river remains swimmable.
    if(x>=277 && x<=321 && z>=4 && z<=40)return null;
    if(x>=-185 && x<=-115 && z>=1185 && z<=1245)return null;
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
  // World-space UVs on the street keep the asphalt grain the same size citywide.
  const surfaceLoader=new THREE.TextureLoader();
  const asphaltTexture=surfaceLoader.load('assets/materials/asphalt-color.jpg'),asphaltNormal=surfaceLoader.load('assets/materials/asphalt-normal.jpg');
  for(const texture of [asphaltTexture,asphaltNormal]){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(.08,.08);texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}
  asphaltTexture.colorSpace=THREE.SRGBColorSpace;
  const asphalt=mats.road.clone();asphalt.color.set(0xc8ced0);asphalt.map=asphaltTexture;asphalt.normalMap=asphaltNormal;asphalt.normalScale.set(.35,.35);
  const street=new THREE.Mesh(new THREE.ShapeGeometry(streetShape),asphalt);street.rotation.x=-Math.PI/2;street.receiveShadow=true;scene.add(street);
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
