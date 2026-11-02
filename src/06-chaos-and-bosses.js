  // Each award extends the combo; the multiplier grows with the chain.
  function awardChaos(points,label,point=null,kind='hit') {
    comboPoints+=points;comboTimer=3.5;gainXp(Math.round(points*(kind==='hero'?.6:kind==='combat'?.4:kind==='trick'?.2:.08)));comboMultiplier=Math.min(10,comboMultiplier+(kind==='trick'?.5:1));
    if(kind==='hit')adjustOpinion(-1.5);else if(kind==='hero')adjustOpinion(8);else if(kind==='oops')adjustOpinion(-6);
    // Hurting the city draws police attention.
    if(kind==='hit')addHeat(Math.min(.4,points/1400));
    updateComboLabel();
  }
  const chaosHud=document.querySelector('.chaos-hud');let chaosIdleTimer=null;
  function updateComboLabel() {
    if(!comboLabel)return;
    chaosHud?.classList.remove('idle');clearTimeout(chaosIdleTimer);chaosIdleTimer=setTimeout(()=>{if(!comboPoints)chaosHud?.classList.add('idle');},6000);
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
    // Impacts, voices, animation and the compact HUD carry the feedback.
    // Keep the call site for shared gameplay events without filling the view with captions.
  }
  function say(actor,kind,chance=1) {
    if(Math.random()>chance || !actor?.group || actor.group.position.distanceTo(position)>60)return;
    if(actor.lastSpoke && elapsed-actor.lastSpoke<2.2)return;actor.lastSpoke=elapsed;
    if((kind==='greet' || kind==='saved' || kind==='revive') && Math.random()<.3)playVoice(actor.group.position,'grunt');
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
  // NPC reactions use recorded voices, with shared cooldowns to keep crowds intelligible.
  function playVoice(point,kind='yelp') {playEffect(kind==='scream'?'voiceScream':'voiceGrunt',point);}
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
  function burst(point,count,color,{speed=6,up=4,life=.8,gravity=12,size=.35,drag=1.5,spread=.3,opacity=1}={}) {
    const colors=Array.isArray(color)?color:[color];
    for(let n=0;n<count;n++) {
      const i=particleCursor;particleCursor=(particleCursor+1)%particleMax;const particle=particles[i];
      particle.life=particle.max=life*(.6+Math.random()*.6);particle.gravity=gravity;particle.drag=drag;particle.size=size*(.6+Math.random()*.8);particle.opacity=opacity;
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
      const t=Math.max(0,particle.life/particle.max);particleAlpha[i]=particle.opacity*Math.min(1,t*2.5);particleSize[i]=particle.size*(.5+.5*t);
    }
    for(const name of ['position','color','size','alpha'])particleGeometry.attributes[name].needsUpdate=true;
  }
  const confetti=[0xff4f6d,0xffd25e,0x5ee0ff,0x8dff7a,0xc68bff,0xffffff];
  // Speed streaks on a 2D overlay sell velocity far better than FOV alone.
  const speedLines=document.getElementById('speed-lines'),speedContext=speedLines?.getContext('2d'),streaks=[];
  function updateSpeedLines(dt,speed) {
    if(!speedContext)return;
    const w=Math.round(innerWidth/2),h=Math.round(innerHeight/2),amount=settings.reduceMotion?0:THREE.MathUtils.smoothstep(speed,24,62)*(slowMotion?.4:1);
    // Resizing a canvas recreates its drawing surface; only do it when the viewport changes.
    if(speedLines.width!==w || speedLines.height!==h){speedLines.width=w;speedLines.height=h;}
    else if(amount>0 || streaks.length)speedContext.clearRect(0,0,w,h);
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
  function impactFeedback(strength) {hitStop=Math.max(hitStop,Math.min(.09,.03+strength*.012));if(!settings.reduceMotion)screenShake=Math.min(1.2,screenShake+strength*.12);}
  // Spider-slap: a short melee cone that sends anything in front flying.
  function spiderSlap() {
    if(paused || koTimer>0)return;
    if(slapCooldown>0){slapQueue=.22;return;}
    const closeTarget=[...pedestrians,...cars,...chargeProps,...bosses.filter(b=>b.status==='active').map(b=>b.actor)].some(a=>a.group.visible&&!a.dead&&a.group.position.distanceToSquared(position)<36);
    if(!onGround && !rope && has('groundPound') && position.y>4 && !pounding && !closeTarget){groundPound();slapCooldown=.4;return;}
    if(finisherReady && closeTarget){slapCooldown=.5;slapAnimation=.3;finisher();return;}
    slapChain=slapChainTimer>0?slapChain%3+1:1;slapChainTimer=.95;
    slapCooldown=.26;slapAnimation=.3;playEffect('slap');
    const forward=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
    const flat=new THREE.Vector3(forward.x,0,forward.z).normalize();let hits=0,hitMetal=false;
    for(const actor of [...pedestrians,...cars,...chargeProps]) {
      if(actor.dead || !actor.group.visible)continue;
      const p=actor.group.position,dx=p.x-position.x,dz=p.z-position.z,dy=p.y-position.y,reach=cars.includes(actor)?4.5+Math.max(actor.hx,actor.hz):3.6;
      const d=Math.hypot(dx,dz);if(d>reach || Math.abs(dy)>3)continue;
      if(d>.6 && (dx*flat.x+dz*flat.z)/d<.45)continue;
      if(actor.propType==='pressure-tank'){if(detonateTank(actor))hits++;continue;}
      const car=cars.includes(actor),power=((car?18:24)+(slapChain===3?10:slapChain===2?3:0))*((progress.owned||[]).includes('gloves')?1.3:1);
      const launch=new THREE.Vector3(flat.x*power,car?9:9+(slapChain===3?6:2)+Math.max(0,forward.y)*10,flat.z*power).addScaledVector(velocity,.5);
      if(actor.webHeld)cancelWebGrab();if(actor.webTether)removeTether(actor.webTether);if(actor.webPinned){clearWebPin(actor);releaseActorWeb(actor);}
      if(actor.knockback) {
        // A second hit can keep a knocked-down or airborne target in the combo.
        const flight=actor.knockback;flight.velocity.copy(launch);flight.phase=null;flight.time=0;flight.remaining=0;flight.fromPlayer=true;flight.bounces=0;flight.spin=(Math.random()>.5?1:-1)*7;
        actor.group.position.y+=.12;if(actor.thug&&!actor.defeated)countHit();
      } else throwActor(actor,flat,false,launch);
      hits++;if(car || !pedestrians.includes(actor))hitMetal=true;
      const point=p.clone().add(new THREE.Vector3(0,1.2,0));burst(point,14,[0xfff2a8,0xffffff],{speed:9,up:3,life:.4,gravity:4,size:.28});
      if(pedestrians.includes(actor)){awardChaos(120,pick(['SPIDER-SLAP','BACKHAND','DISRESPECT','POW!']),point);say(actor,'hit',.8);playVoice(p,'yelp');}
      else if(car)awardChaos(300,'CAR SLAP',point);
      else awardChaos(200,pick(['BENCH PRESS','PUBLIC SEATING YEET','PARKS DEPT. CRYING']),point);
    }
    for(const hydrant of hydrants) {
      const dx=hydrant.position.x-position.x,dz=hydrant.position.z-position.z,d=Math.hypot(dx,dz);
      if(d<2.8 && Math.abs(hydrant.position.y-position.y)<2 && (d<.6 || (dx*flat.x+dz*flat.z)/d>.3)){burstHydrant(hydrant);hits++;}
    }
    for(const gallery of targetGalleries)for(const target of gallery.targets) {
      const dx=target.x-position.x,dz=target.z-position.z,d=Math.hypot(dx,dz);
      if(d<3.5 && Math.abs(target.y-position.y)<3 && (d<.6 || (dx*flat.x+dz*flat.z)/d>.35) && hitGalleryTarget(target))hits++;
    }
    for(const boss of bosses) {
      const a=boss.actor,p=a.group.position;if(boss.status!=='active')continue;
      const dx=p.x-position.x,dz=p.z-position.z,d=Math.hypot(dx,dz);
      if(d>(a===rhino?5.5:4.5) || Math.abs(p.y-position.y)>4 || (d>.6 && (dx*flat.x+dz*flat.z)/d<.4) || elapsed-(boss.lastSlap||-9)<.55)continue;
      boss.lastSlap=elapsed;
      if(a.kind==='electro' && a.state!=='subdued') {
        // Electro's static field zaps bare-handed hits until a web stun shorts it out.
        hitPlayer(position.clone().sub(p),14,6,true,12);damageBoss(a,.25,'SHOCKED SLAP',p.clone().setY(p.y+2.5));
        if(elapsed-(boss.zapHint||-9)>4){boss.zapHint=elapsed;worldPopup('ZAP! STUN HIM WITH WEBS FIRST',p.clone().setY(p.y+3.6),'burst oops',2);}
        hits++;continue;
      }
      damageBoss(a,(progress.owned||[]).includes('gloves')?1.5:1,a.state==='subdued'?'BOSS SMACKDOWN':'BOSS SLAP',p.clone().setY(p.y+2.5));hits++;if(a===rhino)hitMetal=true;
      if(boss.status==='active' && a.state!=='subdued'){p.x+=flat.x*2;p.z+=flat.z*2;}
    }
    if(hits){recentDanger={position:position.clone(),time:2.5};velocity.addScaledVector(flat,onGround?1.8:1);flashReticle();impactFeedback(1.5+Math.min(3,hits));playEffect(hitMetal?'metal':'impact');if(hits>=3)awardChaos(250*hits,`MULTI-SLAP x${hits}`,null);}
  }
  // ---- Villains: district bosses with health bars, news alerts and a trip to jail ----
  const bossBar=document.getElementById('boss-bar'),bossNameLabel=document.getElementById('boss-name'),bossTitleLabel=document.getElementById('boss-title'),bossHealth=document.getElementById('boss-health'),bossTag=document.getElementById('boss-tag');
  const breaking=document.getElementById('breaking'),breakingText=document.getElementById('breaking-text'),villainTracker=document.getElementById('villain-tracker');
  const beaconGeometry=new THREE.CylinderGeometry(2.2,2.2,300,12,1,true);
  const alertVerbs=['IN'];
  const bosses=[
    {actor:rhino,name:'RHINO',title:'Has never once paid for a fender bender',district:'CENTRAL PARK',color:0xff665f,hp:48,home:new THREE.Vector3(0,0,-29)},
    {actor:villains.find(v=>v.kind==='electro'),name:'ELECTRO',title:'Stealing power from the Times Square billboards',district:'TIMES SQUARE',color:0x80eeff,hp:38},
    {actor:villains.find(v=>v.kind==='goblin'),name:'GREEN GOBLIN',title:'Pumpkin-bombing Midtown commuters',district:'MIDTOWN',color:0xa8ff6c,hp:42},
    {actor:villains.find(v=>v.kind==='octopus'),name:'DOC OCK',title:'Robbing Wall Street with four extra arms',district:'THE FINANCIAL DISTRICT',color:0xffc75e,hp:52}
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
    clearTimeout(breakingTimer);breakingTimer=setTimeout(()=>{breaking.hidden=true;},2600);
  }
  function sleepBoss(boss) {
    const a=boss.actor;boss.status='dormant';a.group.visible=false;boss.beacon.visible=false;a.group.position.copy(boss.home);a.enraged=false;
  }
  function activateBoss(boss,announce=true) {
    if(boss.status!=='dormant')return;
    const a=boss.actor;boss.status='active';boss.hp=boss.maxHp;boss.henchmen=false;boss.special=undefined;a.group.visible=true;a.group.position.copy(boss.home);a.group.rotation.set(0,0,0);
    a.state=a===rhino?'roam':'idle';a.timer=1;a.stuck=false;a.webHits=0;a.enraged=false;releaseActorWeb(a);
    if(announce) {
      showBreaking(`${boss.name} ${pick(alertVerbs)} ${boss.district}`);
      setNews(`${boss.name} SPOTTED IN ${boss.district}`);
      playEffect('alert');
    }
    updateVillainTracker();
  }
  // Every third of a boss's health knocks them out briefly, which doubles the damage they take.
  function damageBoss(actor,amount,label,point=null) {
    const boss=actor?.boss;if(!boss || boss.status!=='active')return false;
    countHit();if(dodgeBoost>0)amount*=2;
    if(actor===rhino && actor.state!=='subdued' && !/MISSILE|FINISHER|POUND/.test(label||'')) {
      // Rhino's front plates shrug off most hits: get behind him or make him crash.
      const facing=new THREE.Vector3(-Math.sin(actor.group.rotation.y),0,-Math.cos(actor.group.rotation.y)),toPlayer=position.clone().sub(actor.group.position).setY(0).normalize();
      if(facing.dot(toPlayer)>.2){amount*=.3;if(elapsed-(boss.armorHint||-9)>4){boss.armorHint=elapsed;worldPopup('ARMORED! HIT HIM FROM BEHIND OR MAKE HIM CRASH',actor.group.position.clone().setY(5),'burst oops',2);}}
    }
    const before=boss.hp,stunned=actor.state==='subdued';boss.hp=Math.max(0,boss.hp-amount*(stunned?1.25:1));focusBoss=boss;boss.lastHit=elapsed;
    const where=point||actor.group.position.clone().setY(actor.group.position.y+3);
    if(label)awardChaos(Math.round(amount*(stunned?240:120)),label,where,'trick');
    burst(where,12,[boss.color,0xffffff],{speed:7,life:.45,size:.35});
    if(boss.hp<=0){defeatBoss(boss);return true;}
    const third=boss.maxHp/3;
    if(!stunned && Math.ceil(boss.hp/third)<Math.ceil(before/third)) {
      actor.state='subdued';actor.stuck=true;actor.webRemaining=2.2;actor.timer=0;worldPopup('STUNNED! SLAP THEM!',where,'burst trick',1.6);playEffect('impact');
    }
    if(!actor.enraged && boss.hp<=boss.maxHp/2){actor.enraged=true;worldPopup(`${boss.name} IS ENRAGED`,where.clone().setY(where.y+1.5),'burst oops',1.8);}
    return true;
  }
  function defeatBoss(boss) {
    const a=boss.actor,p=a.group.position;boss.status='defeated';boss.jailTime=0;boss.defeats++;villainsBeaten.add(boss.name);
    if(webGrab===a)cancelWebGrab();clearWebPin(a);
    a.state='subdued';a.stuck=true;a.webRemaining=1e6;
    const wrap=wrapActor(a.group,a);if(a===rhino)wrap.scale.set(2.6,2.2,2.5);else wrap.scale.set(1.35,1.4,1.4);wrap.userData.webActor=a;splatters.push(wrap);
    gainBucks(300);awardChaos(5000,`${boss.name} DEFEATED`,p.clone().setY(p.y+4),'hero');burst(p.clone().setY(p.y+3),70,confetti,{speed:12,up:8,life:1.8,size:.35});
    showBreaking(`${boss.name} DEFEATED`);setNews(`${boss.name} CAPTURED`);
    playEffect('success');impactFeedback(3);adjustOpinion(12);
    addHeat(-2);
    if(villainsBeaten.size===bosses.length)unlockNuke('EVERY VILLAIN BEATEN');
    updateVillainTracker();
  }
  function unlockNuke(reason) {
    if(nukeUnlocked)return;nukeUnlocked=true;
    try{localStorage.setItem('spida.nukeUnlocked','1');}catch(_){/* Keep the unlock for this session only. */}
    setTimeout(()=>showBreaking('NUKE UNLOCKED: PRESS N'),2500);updateVillainTracker();
  }
  function updateVillainTracker() {
    flashDetails();
    if(villainTracker)villainTracker.innerHTML=bosses.map(b=>`<span class="${villainsBeaten.has(b.name)?'beaten':b.status==='active'?'active':''}" style="--villain:#${b.color.toString(16).padStart(6,'0')}">${b.name}</span>`).join('')+
      `<span class="nuke-state ${nukeUnlocked?'ready':''}">${nukeUnlocked?'☢ NUKE READY':`☢ LOCKED ${villainsBeaten.size}/${bosses.length}`}</span>`;
    nukeButton.classList.toggle('locked',!nukeUnlocked);
    nukeButton.title=nukeUnlocked?'Launch nuke':`Locked: beat every villain (${villainsBeaten.size}/${bosses.length}) or cause 250,000 chaos`;
  }
  // Second-phase moves, used once a boss is enraged.
  const strikeMarkers=[];
  function bossSpecial(boss,actors) {
    const a=boss.actor,p=a.group.position;
    if(a===rhino) {
      // A ground stomp with a wide shockwave.
      boss.special=6;enemyBlast(p.clone().setY(.2),8,actors,false);impactFeedback(3);
    } else if(a.kind==='electro') {
      // Lightning strikes land where rings appear, a second later.
      boss.special=4.5;
      for(let i=0;i<3;i++) {
        const point=position.clone().add(new THREE.Vector3((Math.random()-.5)*8,0,(Math.random()-.5)*8));point.y=Math.max(.2,position.y);
        const ring=new THREE.Mesh(attackRingGeometry,electricFlashMaterial);ring.position.copy(point);ring.rotation.x=-Math.PI/2;ring.scale.setScalar(2.6);ring.userData.projectile=true;scene.add(ring);
        strikeMarkers.push({ring,point,time:1.1+i*.25,actors});
      }
      playEffect('electric',p);
    } else if(a.kind==='goblin') {
      // A rain of pumpkin bombs around you.
      boss.special=5;
      for(let i=0;i<5;i++) {
        const mesh=new THREE.Mesh(villainShotGeometry,goblinBombMaterial);mesh.scale.setScalar(.38);mesh.userData.projectile=true;
        mesh.position.set(position.x+(Math.random()-.5)*14,position.y+26+i*2,position.z+(Math.random()-.5)*14);scene.add(mesh);
        enemyProjectiles.push({mesh,velocity:new THREE.Vector3(0,-14,0),electric:false,life:4});
      }
    } else {
      // Doc Ock slams all four arms down around him.
      boss.special=5;enemyBlast(p.clone().setY(.2),10,actors,false);impactFeedback(3);
    }
  }
  function updateStrikes(dt) {
    for(let i=strikeMarkers.length-1;i>=0;i--) {
      const strike=strikeMarkers[i];strike.time-=dt;strike.ring.scale.setScalar(2.6+Math.sin(elapsed*20)*.2);
      if(strike.time<=0){strike.ring.removeFromParent();strikeMarkers.splice(i,1);enemyBlast(strike.point,2.6,strike.actors,true);burst(strike.point.clone().setY(strike.point.y+2),24,[0xb8f8ff,0xffffff],{speed:10,up:8,life:.4,size:.3});}
    }
  }
  function updateBosses(dt) {
    updateStrikes(dt);
    if(nuke)return;
    const actors=[...cars,...pedestrians.filter(n=>!n.dead)];let nearest=null,nearestDistance=70;
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
      if(distance>160 && boss.hp<boss.maxHp)boss.hp=Math.min(boss.maxHp,boss.hp+boss.maxHp*.03*dt);
      if(a.kind==='octopus' && a.state!=='subdued' && distance>10 && distance<70) {
        boss.carTimer=(boss.carTimer??4)-dt*(a.enraged?1.6:1);
        if(boss.carTimer<=0) {
          // Doc Ock hurls the nearest car in a high arc at you.
          boss.carTimer=5.5;
          const car=cars.filter(c=>c.group.visible && !c.knockback && !c.stuck && !c.webPinned && !c.webHeld && c.group.position.distanceTo(p)<35).sort((m,n)=>m.group.position.distanceToSquared(p)-n.group.position.distanceToSquared(p))[0];
          if(car) {
            const time=1.5,start=car.group.position,target=position.clone().addScaledVector(velocity,time*.6);
            const launch=new THREE.Vector3((target.x-start.x)/time,(target.y+1-start.y)/time+.5*22*time,(target.z-start.z)/time);
            throwActor(car,null,false,launch);
            if(car.knockback){car.knockback.fromPlayer=false;car.knockback.bossThrow=true;worldPopup('INCOMING CAR!',p.clone().setY(p.y+4),'burst oops',1.4);playEffect('enemy',p);}
          }
        }
      }
      if(a.enraged && !boss.henchmen && distance<80 && !crime) {
        // Enraged bosses call in henchmen.
        boss.henchmen=true;startCrime(p,true,{name:`${boss.name}'S HENCHMEN`,members:['thug','gunner','brute']});
      }
      if(a.enraged && distance<45 && a.state!=='subdued') {
        boss.special=(boss.special??3)-dt;
        if(boss.special<=0)bossSpecial(boss,actors);
      }
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
      const sleeping=bosses.filter(b=>b.status==='dormant' && b.timer<=0);
      if(sleeping.length && bosses.filter(b=>b.status==='active').length<2)activateBoss(pick(sleeping));
    }
    if(focusBoss && (focusBoss.status!=='active' || elapsed-(focusBoss.lastHit||0)>8))focusBoss=null;
    const shown=focusBoss||nearest;
    if(bossBar) {
      bossBar.hidden=!shown;
      if(shown) {
        bossNameLabel.textContent=shown.name;bossTitleLabel.textContent=shown.actor===rhino?'Dodge the charge or attack from behind':shown.actor.kind==='electro'?'Web to stun':'';bossHealth.style.width=`${shown.hp/shown.maxHp*100}%`;
        bossHealth.style.background=`#${shown.color.toString(16).padStart(6,'0')}`;
        bossTag.textContent=shown.actor.state==='subdued'?'STUNNED':shown.actor.enraged?'ENRAGED':'';bossTag.className=shown.actor.state==='subdued'?'stunned':shown.actor.enraged?'enraged':'';
      }
    }
  }
  // ---- Hero life: health, street crime, combat, progression and the story ----
  const hpBar=document.getElementById('hp-bar'),levelLabel=document.getElementById('level-label'),xpBar=document.getElementById('xp-bar'),hitsHud=document.getElementById('hits');
  const missionHud=document.getElementById('mission'),missionStep=document.getElementById('mission-step'),missionTitle=document.getElementById('mission-title'),missionText=document.getElementById('mission-text'),missionDistance=document.getElementById('mission-distance');
  const districtHud=document.getElementById('district'),suitList=document.getElementById('suits'),shell=document.querySelector('.game-shell');
  let playerHp=100,hurtTimer=0,koTimer=0,comboHits=0,comboHitTimer=0,finisherReady=false,dodgeBoost=0,dodgeSlow=0,senseTimer=0,airJumps=0,pounding=false;
  const stats={crimes:0};
  const progress={xp:0,level:1,suit:'classic',story:0,storyBase:0};
  try{Object.assign(progress,JSON.parse(localStorage.getItem('spida.progress')||'{}'));}catch(_){/* Start fresh when storage is unavailable. */}
  function saveProgress(){try{localStorage.setItem('spida.progress',JSON.stringify(progress));}catch(_){/* Progress then lasts this session. */}}
  const unlocks=[[2,'doubleJump','DOUBLE JUMP'],[3,'suit:symbiote','SYMBIOTE SUIT'],[4,'groundPound','GROUND POUND (slap in midair)'],[5,'suit:iron','IRON SPIDER SUIT'],[6,'quickZip','FASTER WEB ZIPS'],[7,'suit:pajamas','PAJAMA SUIT'],[8,'quickFinisher','FASTER FINISHERS'],[9,'suit:noir','NOIR SUIT'],[10,'suit:gold','GOLDEN MENACE SUIT']];
  const has=key=>(progress.owned||[]).includes(key)||unlocks.some(([level,k])=>k===key && progress.level>=level);
  const xpForLevel=level=>Math.round(2500*(1+.35*(level-1)));
  function gainXp(amount) {
    progress.xp+=Math.min(3000,amount);
    while(progress.xp>=xpForLevel(progress.level)) {
      progress.xp-=xpForLevel(progress.level);progress.level++;
      const unlock=unlocks.find(([level])=>level===progress.level);
      showBreaking(`LEVEL ${progress.level}!${unlock?` UNLOCKED: ${unlock[2]}`:''}`);playEffect('success');
      burst(position.clone().setY(position.y+2),60,confetti,{speed:10,up:6,life:1.4,size:.3});updateSuitButtons();
    }
    updateHeroHud();saveProgress();
  }
  function updateHeroHud() {
    if(hpBar){hpBar.style.width=`${playerHp}%`;hpBar.style.background=playerHp<30?'#ff4f4f':playerHp<60?'#ffc75e':'#6ff09a';}
    if(levelLabel){levelLabel.textContent=`LV ${progress.level}`;xpBar.style.width=`${progress.xp/xpForLevel(progress.level)*100}%`;}
    shell.classList.toggle('low-hp',playerHp<30 && koTimer<=0);
  }
  // Suits recolor the first-person arms and the swing legs.
  const suits={classic:{name:'Classic',sleeve:0x213d66,glove:0xb82b31},symbiote:{name:'Symbiote',sleeve:0x111116,glove:0x24242c},iron:{name:'Iron Spider',sleeve:0xb8892b,glove:0xa3141c},
    pajamas:{name:'Pajamas',sleeve:0x9fd3ff,glove:0xffb7d5},noir:{name:'Noir',sleeve:0x2b2b2b,glove:0x575757},gold:{name:'Golden Menace',sleeve:0xd4a017,glove:0xfff0a8}};
  function applySuit(key) {
    const suit=suits[key]||suits.classic,color=new THREE.Color();progress.suit=key;
    for(const hand of [leftHand,rightHand]) {
      const mesh=hand.children[0],colors=mesh.geometry.attributes.color,mask=hand.userData.sleeveMask;
      for(let i=0;i<colors.count;i++){color.set(mask[i]?suit.sleeve:suit.glove);colors.setXYZ(i,color.r,color.g,color.b);}
      colors.needsUpdate=true;
    }
    legSuit.color.set(suit.sleeve);bootSuit.color.set(suit.glove);rigRed.value.set(key==='symbiote'?0x363841:suit.glove);rigBlue.value.set(key==='symbiote'?0x1d2028:suit.sleeve);rigLogo.value.set(key==='symbiote'?0xe1e7ec:key==='noir'?0x94999e:0x11151d);saveProgress();updateSuitButtons();
  }
  function updateSuitButtons() {
    if(!suitList)return;
    suitList.innerHTML='';
    for(const [key,suit] of Object.entries(suits)) {
      const unlocked=key==='classic'||has(`suit:${key}`),button=document.createElement('button');button.type='button';
      button.textContent=unlocked?suit.name:`🔒 ${suit.name}`;button.disabled=!unlocked;button.classList.toggle('on',progress.suit===key);
      button.addEventListener('click',()=>applySuit(key));suitList.appendChild(button);
    }
  }
  function damagePlayer(amount) {
    if(koTimer>0 || amount<=0)return;
    if((progress.owned||[]).includes('lining'))amount*=.75;
    playerHp=Math.max(0,playerHp-amount);hurtTimer=4;
    shell.classList.remove('hurt');void shell.offsetWidth;shell.classList.add('hurt');
    if(playerHp<=0)knockOut();
    updateHeroHud();
  }
  function knockOut() {
    koTimer=2.6;swing(false);cancelWebGrab();shell.classList.add('ko');playVoice(position,'scream');
    // Getting knocked out while wanted ends in an arrest, which clears the heat.
    if(stars()>0){showBreaking('ARRESTED');clearPolice();}else showBreaking('KNOCKED OUT');adjustOpinion(-4);
  }
  // Hits on enemies build a combo; a full combo charges the finisher.
  function countHit() {
    comboHits++;comboHitTimer=2.6;
    if(comboHits>=(has('quickFinisher')?4:6) && !finisherReady){finisherReady=true;worldPopup('FINISHER READY: SLAP!',position.clone().add(new THREE.Vector3(-Math.sin(yaw)*4,2.2,-Math.cos(yaw)*4)),'burst trick',1.4);}
    if(hitsHud){hitsHud.hidden=false;hitsHud.textContent=`${comboHits} HITS${finisherReady?' • FINISHER READY':''}`;hitsHud.classList.toggle('ready',finisherReady);}
  }
  function finisher() {
    finisherReady=false;comboHits=0;dodgeSlow=.9;impactFeedback(6);playEffect('collapse');
    burst(position.clone().setY(position.y+1),90,[0xff3b3b,0x3b6bff,0xffffff],{speed:18,up:4,life:.9,size:.4});
    let hits=0;
    for(const npc of pedestrians) {
      const q=npc.group.position,d=Math.hypot(q.x-position.x,q.z-position.z);
      if(npc.dead || !npc.group.visible || d>(npc.thug?11:6) || Math.abs(q.y-position.y)>4)continue;
      const away=new THREE.Vector3(q.x-position.x,0,q.z-position.z).normalize();throwActor(npc,away,false,away.multiplyScalar(26).add(new THREE.Vector3(0,16,0)));hits++;
    }
    for(const boss of bosses){const q=boss.actor.group.position;if(boss.status==='active' && q.distanceTo(position)<11)damageBoss(boss.actor,3,'FINISHER');}
    awardChaos(400+hits*150,'SPIDER-FINISHER',position.clone().add(new THREE.Vector3(-Math.sin(yaw)*4,2,-Math.cos(yaw)*4)),'trick');
    if(hitsHud)hitsHud.hidden=true;
  }
  function groundPound() {pounding=true;velocity.set(velocity.x*.3,-46,velocity.z*.3);swing(false);playEffect('zip');}
  function poundImpact() {
    pounding=false;impactFeedback(5);playEffect('collapse');
    burst(position.clone().setY(position.y+.3),70,[0xd8d0c4,0xffffff],{speed:16,up:3,life:1,gravity:4,size:1,drag:2.5});
    let hits=0;
    for(const npc of pedestrians) {
      const q=npc.group.position,d=Math.hypot(q.x-position.x,q.z-position.z);
      if(npc.dead || !npc.group.visible || d>9 || Math.abs(q.y-position.y)>2.5)continue;
      const away=new THREE.Vector3(q.x-position.x,0,q.z-position.z).normalize();throwActor(npc,away,false,away.multiplyScalar(16-d).add(new THREE.Vector3(0,14,0)));hits++;
    }
    for(const boss of bosses){const q=boss.actor.group.position;if(boss.status==='active' && Math.hypot(q.x-position.x,q.z-position.z)<9 && Math.abs(q.y-position.y)<4)damageBoss(boss.actor,2,'GROUND POUND');}
    awardChaos(250+hits*80,'GROUND POUND',null,'trick');
  }
  // ---- Street crime ----
  const thugs=[];
  for(let i=0;i<9;i++) {
    const style=i<5?'thug':i<7?'gunner':'brute',thug=makePedestrian(0,-5000-i*4,9100+i*17,0,-5040,style);
    thug.thug=style;thug.settled=true;thug.group.visible=false;thugs.push(thug);
  }
  const crimeTypes=[{name:'MUGGING',members:['thug','thug'],victim:true},{name:'GANG FIGHT',members:['thug','thug','gunner','brute']},{name:'ARMED ROBBERY',members:['thug','gunner','gunner'],victim:true},{name:'TURF WAR',members:['brute','thug','thug','thug','gunner']}];
  let crime=null,crimeTimer=35;
  const crimeBeacon=new THREE.Mesh(beaconGeometry,new THREE.MeshBasicMaterial({color:0xff4040,transparent:true,opacity:.2,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));
  const missionBeacon=new THREE.Mesh(beaconGeometry,new THREE.MeshBasicMaterial({color:0xffd25e,transparent:true,opacity:.2,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));
  for(const beacon of [crimeBeacon,missionBeacon]){beacon.visible=false;beacon.userData.projectile=true;beacon.raycast=()=>{};scene.add(beacon);}
  function districtName(x,z) {
    if(x>=277 && x<=321 && z>=4 && z<=40)return 'HARBOR ISLAND';
    if(x>=-185 && x<=-115 && z>=1185 && z<=1245)return 'LIBERTY ISLAND';
    if(x>=-200 && x<=200 && z>=-680 && z< -480)return 'NORTH END';
    if(inPark(x,z))return 'CENTRAL PARK';
    if(x>300)return z>1060?'CONEY ISLAND':{['downtown-brooklyn']:'DOWNTOWN BROOKLYN',dumbo:'DUMBO',brooklyn:'BROOKLYN'}[districtAt(x,z)];
    if(z>942)return 'BATTERY PARK';
    return {harlem:'HARLEM',uptown:x<-30?'THE UPPER WEST SIDE':'THE UPPER EAST SIDE',midtown:'MIDTOWN',village:'THE VILLAGE',fidi:'THE FINANCIAL DISTRICT'}[districtAt(x,z)];
  }
  function startCrime(near=position,close=false,forcedType=null) {
    if(crime || nuke)return false;
    for(let tries=0;tries<25;tries++) {
      const angle=Math.random()*Math.PI*2,d=close?35+Math.random()*30:60+Math.random()*80;
      const x=Math.round((near.x+Math.cos(angle)*d)/40)*40+6.4,z=Math.round((near.z+Math.sin(angle)*d)/40)*40+12;
      if(x<worldMinX+10||x>worldMaxX-10||z<worldMinZ+10||z>worldMaxZ-10||waterAt(x,z)||inPark(x,z))continue;
      if((buildingCells.get(`${Math.floor(x/40)},${Math.floor(z/40)}`)||[]).some(b=>insideBuilding(x,z,b,1.5)))continue;
      const type=forcedType||pick(crimeTypes),members=[];
      for(const style of type.members){const thug=thugs.find(t=>t.thug===style && !members.includes(t))||thugs.find(t=>!members.includes(t));if(thug)members.push(thug);}
      members.forEach((thug,i)=>{
        if(thug.webPinned)clearWebPin(thug);releaseActorWeb(thug);
        thug.dead=false;thug.knockback=null;thug.defeated=false;thug.windup=0;thug.punchTimer=0;thug.cooldown=1+i*.4;thug.hp=thug.thug==='brute'?3:1;thug.top=thug.uprightTop;
        thug.group.visible=true;thug.group.rotation.set(0,0,0);thug.group.position.set(x+Math.cos(i*2.4)*2.2,.45,z+Math.sin(i*2.4)*2.2);
        thug.leftArm.rotation.x=thug.rightArm.rotation.x=thug.leftLeg.rotation.x=thug.rightLeg.rotation.x=0;if(thug.gunMount)thug.gunMount.rotation.x=0;
      });
      let victim=null;
      if(type.victim) {
        victim=pedestrians.filter(n=>!n.thug && !n.dead && !n.settled && !n.wheelchair && !n.knockback && n.group.visible && n!==rescue?.actor).sort((a,b)=>a.group.position.distanceToSquared(new THREE.Vector3(x,.45,z))-b.group.position.distanceToSquared(new THREE.Vector3(x,.45,z)))[0]||null;
        if(victim){cancelVisit(victim);cancelDonation(victim);victim.crimeVictim=true;victim.group.position.set(x,.45,z);}
      }
      crime={type,members,victim,x,z,time:0};members.forEach(thug=>thug.crime=crime);
      crimeBeacon.position.set(x,150,z);crimeBeacon.visible=true;
      showBreaking(`🚨 ${type.name} IN ${districtName(x,z)}`);playEffect('alert');
      return true;
    }
    return false;
  }
  function endCrime(success,silent=false) {
    if(!crime)return;
    const ended=crime;crime=null;crimeBeacon.visible=false;crimeTimer=45+Math.random()*30;
    if(ended.victim){ended.victim.crimeVictim=false;ended.victim.leftArm.rotation.x=ended.victim.rightArm.rotation.x=0;if(success)say(ended.victim,'saved');}
    if(success) {
      stats.crimes++;addHeat(-1);gainBucks(50);awardChaos(900,`${ended.type.name} STOPPED`,new THREE.Vector3(ended.x,3,ended.z),'hero');
      setNews(`${ended.type.name} STOPPED IN ${districtName(ended.x,ended.z)}`);
    } else if(!silent)showBreaking('CRIMINALS ESCAPED');
    // Defeated crooks lie around a bit before the city tidies them up.
    setTimeout(()=>{for(const thug of ended.members)if(thug.crime!==crime){thug.crime=null;thug.group.visible=false;thug.knockback=null;releaseActorWeb(thug);}},success?9000:0);
  }
  function defeatThug(thug,label) {
    if(thug.defeated)return;
    thug.defeated=true;awardChaos(thug.thug==='brute'?500:250,label,thug.group.position.clone().setY(thug.group.position.y+2.4),'combat');
    if(crime && crime.members.every(t=>t.defeated))endCrime(true);
  }
  function showDanger() {senseTimer=.55;}
  function fireBullet(thug) {
    const origin=thug.gunMount && thug.visualRoot?.parent?thug.gunMount.localToWorld(new THREE.Vector3(0,0,-.25)):thug.group.position.clone().add(new THREE.Vector3(0,1.4,0));
    const target=position.clone().add(new THREE.Vector3(0,1.1,0));
    const direction=target.sub(origin).normalize();direction.x+=(Math.random()-.5)*.06;direction.y+=(Math.random()-.5)*.04;direction.normalize();
    const mesh=new THREE.Mesh(villainShotGeometry,goblinBombMaterial);mesh.scale.set(.08,.08,.08);mesh.position.copy(origin);mesh.userData.projectile=true;scene.add(mesh);
    enemyProjectiles.push({mesh,velocity:direction.multiplyScalar(34),bullet:true,life:2});playEffect('bomb',origin);
    burst(origin,5,[0xffe08a,0xffffff],{speed:3,life:.15,size:.2,gravity:0});
  }
  function updateThug(npc,dt) {
    if(!npc.crime || npc.defeated || npc.dead)return;
    if(npc.stuck){defeatThug(npc,'WEBBED UP');return;}
    const p=npc.group.position,dx=position.x-p.x,dz=position.z-p.z,d=Math.hypot(dx,dz),engaged=d<35 && Math.abs(position.y-p.y)<10 && koTimer<=0;
    npc.cooldown=Math.max(0,npc.cooldown-dt);npc.punchTimer=Math.max(0,(npc.punchTimer||0)-dt);
    if(npc.windup>0) {
      // Telegraphed punch: spider-sense warns you, and jumping now is a perfect dodge.
      npc.windup-=dt;npc.rightArm.rotation.x=.55;npc.leftArm.rotation.x=.35;showDanger();
      if(npc.windup<=0) {
        if(d<2.2 && Math.abs(position.y-p.y)<1.7)hitPlayer(new THREE.Vector3(dx,0,dz),npc.thug==='brute'?20:13,npc.thug==='brute'?9:6,false,npc.thug==='brute'?20:11);
        npc.cooldown=npc.thug==='brute'?1.8:1.3;npc.punchTimer=.22;npc.rightArm.rotation.x=1.3;playVoice(p,'grunt');
      }
      return;
    }
    const targetX=engaged?position.x:npc.crime.x,targetZ=engaged?position.z:npc.crime.z,tx=targetX-p.x,tz=targetZ-p.z,td=Math.hypot(tx,tz);
    const keep=npc.thug==='gunner' && engaged?(d<9?-1:d>17?1:0):(td>(engaged?1.5:2.4)?1:0);
    if(keep!==0 && td>.01) {
      const oldX=p.x,oldZ=p.z,step=(npc.thug==='brute'?2.7:3.5)*dt*keep;p.x+=tx/td*step;p.z+=tz/td*step;
      if((buildingCells.get(`${Math.floor(p.x/40)},${Math.floor(p.z/40)}`)||[]).some(b=>insideBuilding(p.x,p.z,b,.4)) || waterAt(p.x,p.z)){p.x=oldX;p.z=oldZ;}
      npc.step+=Math.abs(step)*9;const stride=Math.sin(npc.step)*.55;
      npc.leftLeg.rotation.x=stride;npc.rightLeg.rotation.x=-stride;poseWalkingArms(npc,stride,true);
    } else {npc.leftLeg.rotation.x=npc.rightLeg.rotation.x=0;npc.leftArm.rotation.x=.3+Math.sin(elapsed*3+npc.seed)*.15;npc.rightArm.rotation.x=.3-Math.sin(elapsed*3+npc.seed)*.15;}
    if(npc.thug==='gunner' && engaged)npc.rightArm.rotation.x=1.28;
    else if(npc.punchTimer>0)npc.rightArm.rotation.x=.55+.75*npc.punchTimer/.22;
    if(npc.gunMount)npc.gunMount.rotation.x=-npc.rightArm.rotation.x;
    npc.group.rotation.y=engaged?Math.atan2(-dx,-dz):Math.atan2(-tx,-tz);
    if(!engaged)return;
    if(npc.thug==='gunner'){if(npc.cooldown<=0 && d<30){fireBullet(npc);npc.cooldown=1.9+Math.random()*1.2;}}
    else if(d<1.9 && npc.cooldown<=0)npc.windup=npc.thug==='brute'?.8:.55;
    if(Math.random()<dt*.15)worldPopup(pick(['Get him!','It\'s the bug!','You want some?!','Mind your business, pajamas','I got a permit for this!']),p.clone().setY(p.y+2.4),'speech',1.8,npc);
  }
  function updateCrime(dt) {
    if(!crime){crimeTimer-=dt*(1+nightAmount);if(crimeTimer<=0){if(!startCrime())crimeTimer=8;}return;}
    crime.time+=dt;crimeBeacon.material.opacity=.15+.08*Math.sin(elapsed*5);
    crimeBeacon.visible=Math.hypot(position.x-crime.x,position.z-crime.z)>40;
    for(const thug of crime.members)if(thug.dead && !thug.defeated)defeatThug(thug,'PERMANENTLY RETIRED');
    if(crime.victim && !crime.victim.knockback && !crime.victim.dead){const v=crime.victim;v.leftArm.rotation.x=v.rightArm.rotation.x=2.35;if(Math.random()<dt*.2)say(v,'webbed');}
    if(crime.time>100 && Math.hypot(position.x-crime.x,position.z-crime.z)>60)endCrime(false);
  }
  // ---- Story ----
  const bossNamed=name=>bosses.find(b=>b.name===name);
  const story=[
    {title:'STREET CRIME',text:'Stop a street crime. Follow the red beacon.',check:()=>stats.crimes>=1,start:()=>{if(!crime){crimeTimer=0;startCrime(position,true);}},target:()=>crime?new THREE.Vector3(crime.x,0,crime.z):null},
    {title:'RHINO',text:'Defeat Rhino in Central Park.',boss:'RHINO'},
    {title:'ELECTRO',text:'Defeat Electro in Times Square.',boss:'ELECTRO'},
    {title:'PIZZA HUNT',text:'Find 3 golden pizza slices. Check the rooftops.',count:()=>pizzaCollected.size,need:3,target:()=>pizzaSpots.filter((_,i)=>!pizzaCollected.has(i)).sort((a,b)=>a.distanceToSquared(position)-b.distanceToSquared(position))[0]||null},
    {title:'GREEN GOBLIN',text:'Take down the Green Goblin over Midtown.',boss:'GREEN GOBLIN'},
    {title:'RING RACE',text:'Win a gold medal in any ring race.',check:()=>raceCourses.some(c=>c.best && c.best<=c.par[0]),target:()=>raceCourses.map(c=>c.start).sort((a,b)=>a.distanceToSquared(position)-b.distanceToSquared(position))[0]},
    {title:'DOC OCK',text:'Defeat Doc Ock in the Financial District.',boss:'DOC OCK'},
    {title:'STREET CRIMES',text:'Stop 3 more street crimes.',count:()=>stats.crimes,need:3,start:()=>{if(!crime)crimeTimer=Math.min(crimeTimer,5);},target:()=>crime?new THREE.Vector3(crime.x,0,crime.z):null},
    {title:'NUKE',text:'Press N to launch the nuke.',check:()=>Boolean(nuke),start:()=>unlockNuke('STORY COMPLETE')}
  ];
  let storyStarted=-1;
  function updateStory() {
    const mission=story[progress.story];
    if(!mission){if(missionHud)missionHud.hidden=true;missionBeacon.visible=false;return;}
    if(storyStarted!==progress.story) {
      storyStarted=progress.story;progress.storyBase=mission.count?mission.count():0;
      if(mission.boss){const boss=bossNamed(mission.boss);if(boss.status==='jailed')boss.status='dormant';if(boss.status==='dormant')activateBoss(boss);}
      mission.start?.();saveProgress();
    }
    const boss=mission.boss?bossNamed(mission.boss):null;
    if(boss && boss.status==='dormant')activateBoss(boss,false);
    const done=boss?boss.status==='defeated'||boss.status==='jailed':mission.count?mission.count()-progress.storyBase>=mission.need:mission.check();
    const target=boss?boss.actor.group.position:mission.target?.();
    if(missionHud) {
      missionHud.hidden=false;missionStep.textContent=`STORY ${progress.story+1}/${story.length}`;missionTitle.textContent=mission.title;
      missionText.textContent=mission.count?`${mission.text} (${Math.min(mission.need,mission.count()-progress.storyBase)}/${mission.need})`:mission.text;
      missionDistance.textContent=target?`${Math.round(Math.hypot(target.x-position.x,target.z-position.z))} m`:'';
    }
    missionBeacon.visible=Boolean(target) && Math.hypot(target.x-position.x,target.z-position.z)>40 && !boss;
    if(target)missionBeacon.position.set(target.x,150,target.z);
    storyTarget=target||null;
    if(done) {
      awardChaos(2000,`MISSION COMPLETE: ${mission.title}`,null,'hero');
      setTimeout(()=>showBreaking(`MISSION COMPLETE: ${mission.title}`),1200);
      progress.story++;saveProgress();
      if(progress.story===story.length)setTimeout(()=>showBreaking('STORY COMPLETE'),6000);
    }
  }
  let storyTarget=null;
  // ---- Neighborhood banners ----
  const taglines={'HARLEM':'Brownstones, brunch, and a guy who has seen it all','THE UPPER WEST SIDE':'Strollers the size of sedans','THE UPPER EAST SIDE':'Old money. Older dogs.',
    'CENTRAL PARK':'843 acres of pigeons','MIDTOWN':'Where dreams go to pay rent','THE VILLAGE':'Everyone here has a podcast','THE FINANCIAL DISTRICT':'Too big to fail. Too tall to miss.',
    'BATTERY PARK':'Tourists, ferries, and one very judgmental statue','BROOKLYN':'It was cool before you got here','DUMBO':'Down Under the Manhattan Bridge Overpass. Really.',
    'DOWNTOWN BROOKLYN':'Like Manhattan, but it will fight you about it','CONEY ISLAND':'Hot dogs, sand, and questionable rides'};
  let currentDistrict='',districtTimer=0,districtHideTimer=null;
  function updateDistrict(dt) {
    districtTimer-=dt;if(districtTimer>0 || currentArea)return;districtTimer=.5;
    const name=waterAt(position.x,position.z)?(position.x<0?'THE HUDSON':'THE EAST RIVER'):districtName(position.x,position.z);
    if(!name || name===currentDistrict)return;
    currentDistrict=name;if(!districtHud)return;
    districtHud.querySelector('b').textContent=name;districtHud.querySelector('span').textContent='';
    districtHud.hidden=false;districtHud.classList.remove('show');void districtHud.offsetWidth;districtHud.classList.add('show');
    clearTimeout(districtHideTimer);districtHideTimer=setTimeout(()=>districtHud.hidden=true,2000);
  }
  function updateHero(dt) {
    if(koTimer>0) {
      koTimer-=dt;velocity.x*=Math.exp(-4*dt);velocity.z*=Math.exp(-4*dt);
      if(koTimer<=0){playerHp=100;shell.classList.remove('ko');updateHeroHud();}
    } else if((hurtTimer-=dt)<=0 && playerHp<100){playerHp=Math.min(100,playerHp+9*dt);updateHeroHud();}
    if(comboHitTimer>0){comboHitTimer-=dt;if(comboHitTimer<=0){comboHits=0;if(!finisherReady && hitsHud)hitsHud.hidden=true;}}
    senseTimer=Math.max(0,senseTimer-dt);dodgeSlow=Math.max(0,dodgeSlow-dt);dodgeBoost=Math.max(0,dodgeBoost-dt);
    for(const shot of enemyProjectiles)if(shot.mesh.position.distanceToSquared(position)<14*14 && shot.velocity.dot(position.clone().sub(shot.mesh.position))>0)senseTimer=Math.max(senseTimer,.3);
    shell.classList.toggle('sense',senseTimer>0);
    if(onGround){airJumps=0;if(pounding)poundImpact();}
    if(surfCar && onGround){surfTime+=dt;if(surfTime>=2){surfTime-=2;awardChaos(100,'CAR SURFING',null,'trick');}}else surfTime=0;
    updateCrime(dt);updateStory();updateDistrict(dt);
  }
  // ---- Police and heat: hurting the city brings the cops; staying away loses them ----
  const heatHud=document.getElementById('heat');
  let heat=0,heatHold=0,copSpawnTimer=0,lastStars=0,spotted=false;const lastSeen=new THREE.Vector3();
  const cops=[];
  for(let i=0;i<8;i++){const cop=makePedestrian(0,-5200-i*4,9300+i*23,0,-5240,'cop');cop.cop=true;cop.settled=true;cop.group.visible=false;cops.push(cop);}
  function addHeat(amount) {
    if(titleOpen)return;
    heat=THREE.MathUtils.clamp(heat+amount,0,5);if(amount>0)heatHold=12;
    updateHeatHud();
  }
  function stars(){return Math.ceil(heat-.001);}
  function updateHeatHud() {
    if(!heatHud)return;
    const level=stars();heatHud.hidden=level===0;
    if(level!==lastStars){heatHud.innerHTML=Array.from({length:5},(_,i)=>`<span class="${i<level?'on':''}">★</span>`).join('');lastStars=level;}
  }
  function policeSpot(min,max,around=lastSeen) {
    for(let tries=0;tries<20;tries++) {
      const angle=Math.random()*Math.PI*2,d=min+Math.random()*(max-min),x=around.x+Math.cos(angle)*d,z=around.z+Math.sin(angle)*d;
      if(x<worldMinX+5||x>worldMaxX-5||z<worldMinZ+5||z>worldMaxZ-5||waterAt(x,z))continue;
      if((buildingCells.get(`${Math.floor(x/40)},${Math.floor(z/40)}`)||[]).some(b=>insideBuilding(x,z,b,1.5)))continue;
      return new THREE.Vector3(x,inPark(x,z)?.1+parkElevation(x,z):.45,z);
    }
    return null;
  }
  function deployCop(cop) {
    const spot=policeSpot(40,65);if(!spot)return false;
    if(cop.webPinned)clearWebPin(cop);releaseActorWeb(cop);
    Object.assign(cop,{active:true,defeated:false,dead:false,knockback:null,windup:0,cooldown:1+Math.random(),top:cop.uprightTop});
    cop.group.position.copy(spot);cop.group.rotation.set(0,0,0);cop.group.visible=true;return true;
  }
  function retireCop(cop) {cop.active=false;cop.defeated=false;cop.knockback=null;releaseActorWeb(cop);cop.group.visible=false;}
  // Only takedowns by the player add heat; Rhino flattening a cop is not on you.
  function defeatCop(cop,byPlayer=true) {if(cop.defeated)return;cop.defeated=true;if(byPlayer)addHeat(.6);}
  function fireTaser(cop) {
    const origin=cop.group.position.clone().add(new THREE.Vector3(0,1.3,0)),direction=position.clone().add(new THREE.Vector3(0,1.1,0)).sub(origin).normalize();
    const mesh=new THREE.Mesh(villainShotGeometry,electroShotMaterial);mesh.scale.setScalar(.09);mesh.position.copy(origin);mesh.userData.projectile=true;scene.add(mesh);
    enemyProjectiles.push({mesh,velocity:direction.multiplyScalar(30),taser:true,life:1.4});playEffect('electric',origin);
  }
  function updateCop(npc,dt) {
    if(!npc.active || npc.defeated || npc.dead)return;
    if(npc.stuck){defeatCop(npc);return;}
    if(heat<=0){npc.leftLeg.rotation.x=npc.rightLeg.rotation.x=npc.rightArm.rotation.x=0;return;}
    const p=npc.group.position,sees=p.distanceToSquared(position)<60*60;
    if(!sees && p.distanceToSquared(position)>170*170){retireCop(npc);return;}
    const goal=sees?position:lastSeen,dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz)||1;
    npc.cooldown-=dt;
    const want=d>14?1:sees && d<7?-1:0;
    if(want) {
      const oldX=p.x,oldZ=p.z,step=4.3*dt*want;p.x+=dx/d*step;p.z+=dz/d*step;
      if((buildingCells.get(`${Math.floor(p.x/40)},${Math.floor(p.z/40)}`)||[]).some(b=>insideBuilding(p.x,p.z,b,.4)) || waterAt(p.x,p.z)){p.x=oldX;p.z=oldZ;}
      p.y=inPark(p.x,p.z)?.1+parkElevation(p.x,p.z):.45;
      npc.step+=Math.abs(step)*9;const stride=Math.sin(npc.step)*.6;npc.leftLeg.rotation.x=stride;npc.rightLeg.rotation.x=-stride;npc.leftArm.rotation.x=-stride*.8;
    } else {npc.leftLeg.rotation.x=npc.rightLeg.rotation.x=0;}
    npc.rightArm.rotation.x=d<30?-1.5:0;npc.group.rotation.y=Math.atan2(-dx,-dz);
    if(sees && d<30 && npc.cooldown<=0 && koTimer<=0){fireTaser(npc);npc.cooldown=1.5+Math.random()*1.2;}
  }
  // Cruisers drive straight at you across the city, plowing through anyone in the way.
  function makeCruiser() {
    const b=new ToyKit.Builder();
    b.add(ToyKit.roundedBox(2,.8,4.5,.25),'#f2f2f0',{p:[0,.75,0]});
    for(const side of [-1,1])b.add(ToyKit.roundedBox(.04,.42,3.2,.02),'#1d3570',{p:[side*1.0,.82,0]});
    b.add(ToyKit.roundedBox(1.7,.62,2.3,.22),'#1d2731',{p:[0,1.38,.15]});
    b.add(ToyKit.roundedBox(1.1,.12,.36,.05),'#20242a',{p:[0,1.75,.1]});
    for(const x of [-.92,.92])for(const z of [-1.45,1.45])b.add(ToyKit.cylinder(.36,.36,.26,14),'#16181b',{p:[x,.36,z],r:[0,0,Math.PI/2]});
    const group=new THREE.Group();group.add(b.mesh());group.visible=false;scene.add(group);
    const red=new THREE.Mesh(new THREE.BoxGeometry(.48,.14,.3),new THREE.MeshBasicMaterial({color:0xff2a2a,toneMapped:false})),blue=new THREE.Mesh(new THREE.BoxGeometry(.48,.14,.3),new THREE.MeshBasicMaterial({color:0x2a5cff,toneMapped:false}));
    red.position.set(-.28,1.86,.1);blue.position.set(.28,1.86,.1);group.add(red,blue);
    group.traverse(child=>{if(child.isMesh)child.castShadow=true;});
    return {group,red,blue,speed:0,heading:0,active:false,hitCooldown:0};
  }
  const cruisers=[makeCruiser(),makeCruiser()];
  function updateCruiser(car,dt) {
    if(!car.active){car.group.visible=false;return;}
    const p=car.group.position,goal=spotted?position:lastSeen,dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz);
    if(p.distanceToSquared(position)>220*220){car.active=false;return;}
    const desired=Math.atan2(dx,dz);let turn=Math.atan2(Math.sin(desired-car.heading),Math.cos(desired-car.heading));
    car.heading+=THREE.MathUtils.clamp(turn,-2.2*dt,2.2*dt);
    const targetSpeed=d>9?24:0;car.speed+=THREE.MathUtils.clamp(targetSpeed-car.speed,-18*dt,9*dt);
    const nx=p.x+Math.sin(car.heading)*car.speed*dt,nz=p.z+Math.cos(car.heading)*car.speed*dt;
    const blocked=(buildingCells.get(`${Math.floor(nx/40)},${Math.floor(nz/40)}`)||[]).some(b=>insideBuilding(nx,nz,b,1.2))||waterAt(nx,nz);
    if(blocked){car.speed*=.4;car.heading+=(Math.random()<.5?-1:1)*1.2*dt*10;}else{p.x=nx;p.z=nz;}
    p.y=0;car.group.rotation.y=car.heading;
    const flash=Math.floor(elapsed*7)%2===0;car.red.visible=flash;car.blue.visible=!flash;car.group.visible=true;
    car.hitCooldown=Math.max(0,car.hitCooldown-dt);
    if(car.speed>8) {
      for(const npc of pedestrians) {
        const q=npc.group.position;if(npc.dead || npc.knockback || !npc.group.visible || npc.cop || Math.abs(q.x-p.x)>2.2 || Math.abs(q.z-p.z)>2.2)continue;
        throwActor(npc,null,false,new THREE.Vector3(Math.sin(car.heading)*car.speed*.8,8,Math.cos(car.heading)*car.speed*.8));if(npc.knockback)npc.knockback.fromPlayer=false;
      }
      if(car.hitCooldown<=0 && position.y<2.5 && p.distanceTo(position)<2.6){car.hitCooldown=1.5;hitPlayer(new THREE.Vector3(Math.sin(car.heading),0,Math.cos(car.heading)),22,8,false,16);}
    }
  }
  // A helicopter holds a searchlight on you from above.
  const policeHeli=(()=>{
    const b=new ToyKit.Builder();
    b.add(ToyKit.sphere(1,16,12),'#1d3570',{s:[1.3,1.1,2.1]});b.add(ToyKit.sphere(1,14,10),'#9fc2e8',{p:[0,.25,-1.3],s:[.9,.7,.8]});
    b.rod([0,.2,1.6],[0,.6,5.2],.22,'#1d3570');b.add(ToyKit.roundedBox(.1,1.1,.8,.04),'#f2f2f0',{p:[0,1,5.2]});
    for(const side of [-1,1])b.rod([side*.8,-1.2,-1.2],[side*.8,-1.2,1.4],.06,'#20242a');
    const group=new THREE.Group();group.add(b.mesh(ToyKit.metalMaterial));group.visible=false;scene.add(group);
    const rotor=new THREE.Mesh(new THREE.BoxGeometry(9,.06,.35),new THREE.MeshStandardMaterial({color:0x222428}));rotor.position.y=1.35;group.add(rotor);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.5,7,1,20,1,true),new THREE.MeshBasicMaterial({color:0xfff6d0,transparent:true,opacity:.13,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
    beam.raycast=()=>{};scene.add(beam);beam.visible=false;
    return {group,rotor,beam,active:false,angle:0};
  })();
  const beamUp=new THREE.Vector3(0,1,0);
  function updateHeli(dt) {
    const heli=policeHeli,p=heli.group.position;
    if(!heli.active){if(heli.group.visible){p.y+=dt*15;if(p.y>position.y+140){heli.group.visible=false;}}heli.beam.visible=false;return;}
    if(!heli.group.visible){heli.group.visible=true;p.set(position.x+120,position.y+90,position.z+120);}
    heli.angle+=dt*(spotted?.35:.8);
    const focus=spotted?position:lastSeen,radius=spotted?14:30;
    const target=new THREE.Vector3(focus.x+Math.sin(heli.angle)*radius,Math.max(focus.y,0)+32,focus.z+Math.cos(heli.angle)*radius);
    // Top speed is below a fast swing, so you can outrun it.
    const move=target.sub(p),distance=move.length();if(distance>.01)p.addScaledVector(move,Math.min(1,19*dt/distance));
    heli.group.lookAt(focus.x,p.y,focus.z);heli.rotor.rotation.y+=dt*25;
    // The beam sweeps toward the player when spotted, otherwise the ground below.
    const from=p.clone().add(new THREE.Vector3(0,-1.3,0)),to=spotted?position.clone().add(new THREE.Vector3(0,.2,0)):new THREE.Vector3(p.x,0,p.z),length=from.distanceTo(to);
    heli.beam.visible=true;heli.beam.position.copy(from).lerp(to,.5);heli.beam.scale.set(1,length,1);
    heli.beam.quaternion.setFromUnitVectors(beamUp,from.clone().sub(to).normalize());
  }
