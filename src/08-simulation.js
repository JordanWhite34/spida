  // Moving actors only need to check nearby cells for traffic and collisions.
  // Rebuild after traffic moves so pedestrians see cars that have wrapped routes.
  // Numeric cell keys avoid building strings for every actor every frame.
  const cellKey=(x,z)=>(x+2048)*4096+(z+2048);
  function actorGrid(actors,size=40) {
    const cells=new Map();cells.cellSize=size;
    for(const actor of actors) {
      const p=actor.group.position,key=cellKey(Math.floor(p.x/size),Math.floor(p.z/size));
      let cell=cells.get(key);if(!cell){cell=[];cells.set(key,cell);}
      cell.push(actor);
    }
    return cells;
  }
  function nearbyActors(grid,actor) {
    const size=grid.cellSize,p=actor.group.position,x=Math.floor(p.x/size),z=Math.floor(p.z/size),near=[];
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++) {
      const cell=grid.get(cellKey(x+dx,z+dz));if(cell)for(const other of cell)near.push(other);
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
      else {const stride=Math.sin(npc.step)*.7;npc.leftLeg.rotation.x=stride;npc.rightLeg.rotation.x=-stride;poseWalkingArms(npc,stride,true);}
      return true;
    }
    p.x=oldX;p.z=oldZ;return true;
  }
  let pedestrianFrame=0;
  // When a nuke is called, every pedestrian drops everything and sprints away from ground zero.
  const fleeTurns=[0,.6,-.6,1.2,-1.2,1.9,-1.9];
  function nukeFlee(npc,dt) {
    if(npc.rooftop || npc.dead || !npc.group.visible)return false;
    const p=npc.group.position,away=Math.atan2(p.x-nuke.target.x,p.z-nuke.target.z);
    if(!npc.nukePanic) {
      npc.nukePanic=true;cancelVisit(npc);cancelDonation(npc);npc.pause=0;npc.crimeVictim=false;npc.panicSpeed=3.2+Math.random()*1.6;
      if(npc.wheelchair)restoreWheelchair(npc);
      for(const leg of [npc.leftLeg,npc.rightLeg])if(leg.userData.knee)leg.userData.knee.rotation.x=0;
    }
    const step=npc.panicSpeed*(npc.wheelchair?.6:1)*dt,oldX=p.x,oldZ=p.z;
    let moved=false;
    for(const turn of fleeTurns) {
      const angle=away+turn;p.x=THREE.MathUtils.clamp(oldX+Math.sin(angle)*step,worldMinX+1,worldMaxX-1);p.z=THREE.MathUtils.clamp(oldZ+Math.cos(angle)*step,worldMinZ+1,worldMaxZ-1);
      const local=buildingCells.get(`${Math.floor(p.x/40)},${Math.floor(p.z/40)}`)||[];
      if(waterAt(p.x,p.z) || local.some(b=>insideBuilding(p.x,p.z,b,Math.max(npc.hx,npc.hz)) && !insideBuilding(oldX,oldZ,b,Math.max(npc.hx,npc.hz)))){p.x=oldX;p.z=oldZ;continue;}
      npc.group.rotation.y=angle+Math.PI;moved=true;break;
    }
    p.y=inPark(p.x,p.z)?.1+parkElevation(p.x,p.z):.45;
    npc.step+=step*12;const stride=moved?Math.sin(npc.step)*.9:0;
    if(npc.wheelchair){for(const wheel of npc.wheelchair.wheels)wheel.rotateZ(step*2.5);}
    else {npc.leftLeg.rotation.x=stride;npc.rightLeg.rotation.x=-stride;}
    // Arms up, flailing.
    npc.leftArm.rotation.x=2.05+Math.sin(npc.step*1.3)*.35;npc.rightArm.rotation.x=2.05-Math.sin(npc.step*1.3)*.35;
    if(Math.random()<dt*.12){say(npc,'panic');if(Math.random()<.3)playVoice(p,'scream');}
    return true;
  }
  function endNukePanic() {
    for(const npc of pedestrians) {
      if(!npc.nukePanic)continue;
      npc.nukePanic=false;npc.leftArm.rotation.x=npc.rightArm.rotation.x=npc.leftLeg.rotation.x=npc.rightLeg.rotation.x=0;
      if(npc.settled){seatedRest(npc);if(npc.rooftopKind==='view')rooftopRest(npc);}else if(npc.wheelchair)restoreWheelchair(npc);else nearestRouteCorner(npc);
    }
  }
  function padAvailable(pad) {return pad.group.visible && !pad.owner?.destroyed;}
  function newAirTrick() {
    return {time:0,distance:0,maxSpeed:0,swings:0,zips:0,bounces:0,nearMisses:0,lastNearMiss:-10};
  }
  function noteAirMove(type) {
    if(!airTrick)airTrick=newAirTrick();
    airTrick[type]++;
  }
  // Link swings, zips and close passes into a single score when the player lands.
  function updateAirTrick(dt,frameStart) {
    if(nuke || koTimer>0){airTrick=null;return;}
    if(onGround) {
      if(airTrick && airTrick.time>=1.8 && (airTrick.distance>30 || airTrick.swings>=2 || airTrick.zips || airTrick.bounces)) {
        const score=Math.min(2000,Math.round(airTrick.distance*3+airTrick.maxSpeed*4+airTrick.swings*100+airTrick.zips*120+airTrick.bounces*100+airTrick.nearMisses*160));
        awardChaos(score,'AIR TRICK',null,'trick');
      }
      airTrick=null;return;
    }
    if(!airTrick)airTrick=newAirTrick();
    const trick=airTrick,speed=Math.hypot(velocity.x,velocity.z);
    trick.time+=dt;trick.distance+=Math.hypot(position.x-frameStart.x,position.z-frameStart.z);trick.maxSpeed=Math.max(trick.maxSpeed,speed);
    if(speed>18 && trick.nearMisses<3 && trick.time-trick.lastNearMiss>1.5) {
      const cell=playerColliderCells.get(`${Math.floor(position.x/40)},${Math.floor(position.z/40)}`)||[];
      for(const b of cell) {
        if(b.height<8 || b.walkable || b.destroyed || b.structure?.destroyed || position.y+1.7>=b.height || position.y<(b.bottom||0))continue;
        const dx=Math.max(0,Math.abs(position.x-b.x)-b.w/2),dz=Math.max(0,Math.abs(position.z-b.z)-b.d/2),gap=Math.hypot(dx,dz);
        if(gap>.4 && gap<2){trick.nearMisses++;trick.lastNearMiss=trick.time;break;}
      }
    }
  }
  function resetGallery(gallery) {
    gallery.resetIn=0;
    for(const target of gallery.targets){target.lit=false;target.pivot.rotation.x=0;target.ring.material.color.setHex(0xd5433c);target.center.material.color.setHex(0xffd25e);target.lamp.material.color.setHex(0x765b38);target.lamp.material.emissive.setHex(0x312311);}
  }
  function hitGalleryTarget(target) {
    const gallery=target.gallery;if(target.lit || gallery.resetIn>0 || gallery.owner?.destroyed || !gallery.group.visible)return false;
    target.lit=true;target.ring.material.color.setHex(0x4fc879);target.center.material.color.setHex(0x79e99a);target.lamp.material.color.setHex(0x79e99a);target.lamp.material.emissive.setHex(0x2e9f56);
    target.pivot.rotation.x=-.55;playEffect('impact',new THREE.Vector3(target.x,target.y,target.z));
    burst(new THREE.Vector3(target.x,target.y,target.z),10,[0xffffff,0xffd25e],{speed:4,up:2,life:.35,size:.2});
    awardChaos(100,'TARGET',null,'trick');
    if(gallery.targets.every(t=>t.lit)) {
      gallery.completed++;gallery.resetIn=7;awardChaos(900,'TARGET GALLERY',null,'trick');playEffect('success');
      burst(new THREE.Vector3(gallery.x,gallery.y+2.5,gallery.z),55,confetti,{speed:9,up:6,life:1.2,size:.35});
    }
    return true;
  }
  function updateGalleries(dt) {
    for(const gallery of targetGalleries) {
      if(gallery.resetIn>0){gallery.resetIn=Math.max(0,gallery.resetIn-dt);if(gallery.resetIn===0)resetGallery(gallery);}
      for(const target of gallery.targets)target.pivot.rotation.x+=(0-target.pivot.rotation.x)*(1-Math.exp(-5*dt));
    }
  }
  function pulsePad(pad) {
    pad.compression=1;playEffect('jump',pad.group.position);
    burst(new THREE.Vector3(pad.x,pad.top,pad.z),12,[0xffd35f,0xffffff],{speed:4,up:2,life:.4,size:.25,gravity:3});
  }
  function bounceThrownActor(actor,oldY) {
    const flight=actor.knockback,p=actor.group.position;if(!flight || flight.phase==='down' || flight.velocity.y>=-2 || nuke || elapsed<(actor.nextPadBounce||0))return false;
    for(const pad of bouncePads) {
      if(!padAvailable(pad) || oldY<pad.top-.12 || p.y>pad.top+.12 || (p.x-pad.x)**2+(p.z-pad.z)**2>pad.radius**2)continue;
      p.y=pad.top+.03;flight.velocity.y=Math.min(30,14+Math.abs(flight.velocity.y)*.7);flight.bounces=0;actor.nextPadBounce=elapsed+.8;
      if(flight.rescue){flight.rescue=false;flight.lethal=false;actor.bounceSaved=true;}
      pulsePad(pad);return true;
    }
    return false;
  }
  function updatePadActors(grid) {
    if(nuke)return;
    for(const pad of bouncePads) {
      if(!padAvailable(pad) || (position.x-pad.x)**2+(position.z-pad.z)**2>140**2)continue;
      for(const actor of nearbyActors(grid,pad)) {
        const p=actor.group.position;
        if(actor.dead || !actor.group.visible || actor.knockback || actor.webHeld || actor.webPinned || actor.webTether || actor.stuck || actor===rescue?.actor || elapsed<(actor.nextPadBounce||0))continue;
        if(Math.abs(p.y-pad.y)>1 || (p.x-pad.x)**2+(p.z-pad.z)**2>pad.radius**2)continue;
        actor.nextPadBounce=elapsed+1.2;
        const kick=new THREE.Vector3(Math.sin(actor.seed)*1.7,18+random(actor.seed+elapsed)*4,Math.cos(actor.seed)*1.7);
        throwActor(actor,null,false,kick);if(actor.knockback){actor.knockback.fromPlayer=false;pulsePad(pad);}
      }
    }
  }
  function updatePadVisuals(dt) {
    for(const pad of bouncePads) {
      pad.compression=Math.max(0,pad.compression-dt*4);
      pad.bed.position.y=.46-pad.compression*.18;pad.ring.position.y=.48-pad.compression*.10;
    }
  }
  function bouncePlayer(wasGrounded,fallSpeed) {
    if(nuke || padCooldown>0 || !onGround)return false;
    for(const pad of bouncePads) {
      if(!padAvailable(pad) || Math.abs(position.y-pad.top)>.14 || (position.x-pad.x)**2+(position.z-pad.z)**2>pad.radius**2)continue;
      if(wasGrounded && Math.hypot(velocity.x,velocity.z)<7.5)continue;
      if(!wasGrounded && fallSpeed<2)continue;
      velocity.y=Math.min(30,18+Math.max(0,fallSpeed)*.55);onGround=false;airJumps=0;jumpBuffer=0;padCooldown=.65;
      noteAirMove('bounces');pulsePad(pad);impactFeedback(1.2);awardChaos(180,'BOUNCE',null,'trick');return true;
    }
    return false;
  }
  function detonateTank(tank) {
    if(!tank || tank.rearm>0 || !tank.group.visible || nuke?.phase==='blast')return false;
    const center=tank.group.position.clone().add(new THREE.Vector3(0,.7,0));
    if(tank.webHeld && webGrab===tank)cancelWebGrab();if(tank.webPinned)clearWebPin(tank);if(tank.webTether)removeTether(tank.webTether);releaseActorWeb(tank);
    tank.knockback=null;tank.fuse=0;tank.rearm=18;tank.group.visible=false;
    playEffect('collapse',center);burst(center,65,[0xffd473,0xff9256,0xffffff,0x6d7780],{speed:13,up:6,life:1,size:.6,gravity:7});
    recentDanger={position:center.clone(),time:3};
    for(const actor of [...pedestrians,...cars,...chargeProps]) {
      if(actor===tank || actor.dead || !actor.group.visible)continue;
      const p=actor.group.position,dx=p.x-center.x,dz=p.z-center.z,d=Math.hypot(dx,dz);
      if(d>8 || Math.abs(p.y-center.y)>5)continue;
      if(actor.propType==='pressure-tank'){if(actor.rearm<=0 && !actor.fuse)actor.fuse=.16+random(actor.seed+elapsed)*.25;continue;}
      if(actor.webHeld && webGrab===actor)cancelWebGrab();if(actor.webPinned){clearWebPin(actor);releaseActorWeb(actor);}if(actor.webTether)removeTether(actor.webTether);
      const away=new THREE.Vector3(dx||.1,0,dz||.1).normalize(),launch=away.multiplyScalar(10+Math.max(0,8-d)*1.5).add(new THREE.Vector3(0,10,0));
      if(actor.knockback && actor.knockback.velocity)actor.knockback.velocity.add(launch);
      else throwActor(actor,null,false,launch);
    }
    const dx=position.x-center.x,dz=position.z-center.z,d=Math.hypot(dx,dz);
    if(d<8 && Math.abs(position.y-center.y)<5){const away=new THREE.Vector3(dx||.1,0,dz||.1).normalize();velocity.addScaledVector(away,8+(8-d));velocity.y=Math.max(velocity.y,11);onGround=false;impactFeedback(3);}
    awardChaos(350,'PRESSURE BURST',null,'trick');return true;
  }
  function updateTankTimers(dt) {
    for(const tank of pressureTanks) {
      if(tank.fuse>0){tank.fuse=Math.max(0,tank.fuse-dt);if(tank.fuse===0)detonateTank(tank);}
      if(tank.rearm>0){tank.rearm=Math.max(0,tank.rearm-dt);if(tank.rearm===0){tank.group.position.copy(tank.origin);tank.group.rotation.copy(tank.originRotation);tank.group.visible=true;}}
    }
  }
  function updateWorld(dt) {
    updateRubble(dt);
    for(const building of destructibleBuildings)if(building.destroyed && building.washers)for(const washer of building.washers)updateWasher(washer,dt);
    const actors=[...cars,...pedestrians.filter(npc=>!npc.dead)];
    updateRhino(dt,[...actors,...chargeProps]);
    updateVillains(dt,actors);updateEnemyProjectiles(dt,actors);
    if(recentDanger){recentDanger.time-=dt;if(recentDanger.time<=0)recentDanger=null;}
    const threats=activeDangers();
    for(const prop of chargeProps)if(!nuke?.hitActors.has(prop) && !prop.webHeld && !prop.webTether) {
      if(updateWebPin(prop,dt) || updateKnockback(prop,dt))continue;
      if(prop.stuck){prop.webRemaining=Math.max(0,prop.webRemaining-dt);if(prop.webRemaining===0)releaseActorWeb(prop);}
    }
    let grid=actorGrid(actors);carHitCooldown=Math.max(0,carHitCooldown-dt);
    for(const car of cars) {
      if(nuke?.hitActors.has(car) || car.webTether)continue;
      const p=car.group.position,oldCell=cellKey(Math.floor(p.x/40),Math.floor(p.z/40));
      if(car.beacon) {
        const responding=threats.some(t=>Math.hypot(t.x-p.x,t.z-p.z)<95);
        car.speed=car.normalSpeed*(responding?1.35:1);car.beacon.visible=responding && Math.floor(elapsed*5)%2===0;
      }
      const carStartX=p.x,carStartZ=p.z;
      if(!car.webHeld && !updateWebPin(car,dt) && !updateKnockback(car,dt)) {
        if(rescue?.type==='runaway' && rescue.actor===car && rescue.result==='active' && !car.stuck)updateRunaway(car,nearbyActors(grid,car),dt);
        else updateTraffic(car,nearbyActors(grid,car),dt);
        const wet=waterAt(p.x,p.z);
        if(wet && p.y<wet.surface+.7){p.y+=(wet.floor-p.y)*(1-Math.exp(-5*dt));car.currentSpeed*=Math.exp(-2*dt);car.wading=true;}
        else if(car.wading && !wet){p.y+=(0-p.y)*(1-Math.exp(-8*dt));if(p.y>-.02){p.y=0;car.wading=false;}}
      }
      // Riding on a roof carries you along; standing in the road gets you hit.
      if(surfCar===car && onGround){position.x+=p.x-carStartX;position.z+=p.z-carStartZ;}
      if(!car.knockback && car.currentSpeed>3 && carHitCooldown<=0 && surfCar!==car) {
        const dx=position.x-p.x,dz=position.z-p.z;
        if(Math.abs(dx)<car.hx+.45 && Math.abs(dz)<car.hz+.45 && position.y<p.y+car.top-.3 && position.y>p.y-1) {
          const forward=new THREE.Vector3(-Math.sin(car.group.rotation.y),0,-Math.cos(car.group.rotation.y));
          hitPlayer(forward,Math.max(10,car.currentSpeed*1.6),7,false,Math.round(6+car.currentSpeed*1.4));carHitCooldown=1.2;playEffect('impact',p);
        }
      }
      const newCell=cellKey(Math.floor(p.x/40),Math.floor(p.z/40));
      if(oldCell!==newCell) {
        const old=grid.get(oldCell),index=old.indexOf(car);if(index>=0)old.splice(index,1);
        if(!grid.has(newCell))grid.set(newCell,[]);grid.get(newCell).push(car);
      }
    }
    grid=actorGrid(actors,20);
    const frameDt=dt;pedestrianFrame++;
    for(const npc of pedestrians) {
      let dt=frameDt;
      if(nuke?.hitActors.has(npc) || npc.webTether)continue;
      if(!nuke && !npc.knockback && !npc.webHeld && !npc.webPinned && !npc.thug && !npc.cop && rescue?.actor!==npc) {
        // Far-away walkers are simulated every fourth frame with the time they missed.
        const fx=npc.group.position.x-position.x,fz=npc.group.position.z-position.z;
        const far=fx*fx+fz*fz;if(far>80*80){const every=far>120*120?4:2;npc.simDt=(npc.simDt||0)+frameDt;npc.simSlot??=Math.floor(Math.random()*4);if((pedestrianFrame+npc.simSlot)%every)continue;dt=npc.simDt;npc.simDt=0;}
      }
      if(npc.dead) {
        // Cartoon rules: the flattened get back up eventually.
        if(npc.reviveAt && elapsed>npc.reviveAt && !nuke && !npc.thug){npc.dead=false;npc.reviveAt=0;npc.knockback={ground:npc.group.position.y};recoverKnockback(npc);say(npc,'revive');}
        continue;
      }
      if(npc.webHeld || updateWebPin(npc,dt))continue;
      if(updateKnockback(npc,dt))continue;
      if(nuke && nuke.phase!=='blast' && (!npc.thug || npc.crime) && nukeFlee(npc,dt))continue;
      if(npc.thug){updateThug(npc,dt);continue;}
      if(npc.cop){updateCop(npc,dt);continue;}
      if(npc.crimeVictim)continue;
      if(updateWebbedPedestrian(npc,dt))continue;
      const wet=waterAt(npc.group.position.x,npc.group.position.z);
      if(wet && npc.group.position.y<wet.surface+.7){npc.group.position.y+=(wet.floor-npc.group.position.y)*(1-Math.exp(-5*dt));npc.wading=true;}
      else if(npc.wading && !wet){const ground=npc.parkWalker?.1+parkElevation(npc.group.position.x,npc.group.position.z):.45;npc.group.position.y+=(ground-npc.group.position.y)*(1-Math.exp(-8*dt));if(Math.abs(npc.group.position.y-ground)<.02){npc.group.position.y=ground;npc.wading=false;}}
      if(npc.settled && !npc.rooftop && threats.some(t=>Math.hypot(t.x-npc.group.position.x,t.z-npc.group.position.z)<12 && Math.abs(t.y-npc.group.position.y)<10)) {
        npc.stationHome??={position:npc.group.position.clone(),yaw:npc.group.rotation.y,kind:npc.rooftopKind};
        npc.settled=false;npc.rooftopKind=null;nearestRouteCorner(npc);
      }
      if(npc.settled) {
        if(npc.rooftopKind==='washer')npc.rightArm.rotation.x=1.1+.35*Math.sin(elapsed*2.4+npc.seed);
        else if(npc.rooftopKind==='view')npc.head.rotation.y=.2*Math.sin(elapsed*.4+npc.seed);
        else if(npc.rooftopKind==='party') {npc.leftArm.rotation.x=.65+Math.sin(elapsed*3+npc.seed)*.5;npc.rightArm.rotation.x=.65-Math.sin(elapsed*3+npc.seed)*.5;npc.group.rotation.z=Math.sin(elapsed*2+npc.seed)*.12;}
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
      if((npc.role==='tourist'||npc.role==='influencer') && !npc.photoTimer && opinion>30 && Math.hypot(p.x-position.x,p.z-position.z)<9 && Math.random()<dt*.12)npc.photoTimer=1.6;
      if(npc.photoTimer>0) {
        npc.photoTimer-=dt;npc.group.rotation.y=Math.atan2(p.x-position.x,p.z-position.z);npc.rightArm.rotation.x=1.75;
        if(npc.photoTimer<=0)npc.rightArm.rotation.x=0;
        continue;
      }
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
          restoreWheelchair(npc);npc.leftArm.rotation.x=npc.rightArm.rotation.x=.22+Math.sin(npc.step)*.2;
          for(const wheel of npc.wheelchair.wheels)wheel.rotateZ(step*2.5);
        } else {npc.leftLeg.rotation.x=stride;npc.rightLeg.rotation.x=-stride;poseWalkingArms(npc,stride);}
        npc.head.rotation.y=Math.sin(elapsed*.65+npc.seed)*.08;
        // Passers-by have opinions about you.
        if(Math.random()<dt*.35 && Math.hypot(p.x-position.x,p.z-position.z)<5 && Math.abs(p.y-position.y)<2 && Math.hypot(velocity.x,velocity.z)<6)say(npc,'greet');
      }
    }
    updateCityCart(cityEvent,grid,dt);updatePadActors(grid);updateTethers(dt);updateDogs(dt);updateLandmarks(dt);updateEvents(dt);
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
      const hits=raycaster.intersectObjects(targets,true),hit=distantActorHit(raycaster.ray,hits[0]?.distance??travel)||hits[0];
      if(hit) { playEffect('splat',hit.point);splatter(hit);flashReticle();scene.remove(shot.mesh);projectiles.splice(i,1); }
      else { shot.mesh.position.addScaledVector(shot.direction,travel); if(shot.life<=0){scene.remove(shot.mesh);projectiles.splice(i,1);} }
    }
  }
  function update(dt) {
    if(blackoutMode==='out') {blackout=Math.max(0,blackout-dt/1.2);blastBlackout.style.opacity=String(blackout);if(blackout===0)blackoutMode='';}
    elapsed+=dt;shockTime=Math.max(0,shockTime-dt);attackImmunity=Math.max(0,attackImmunity-dt);padCooldown=Math.max(0,padCooldown-dt);previous.copy(position);updateNuke(dt);updateTankTimers(dt);updatePadVisuals(dt);updateRescue(dt);updateWorld(dt);updateCityEvent(dt);
    feedbackTime=Math.max(0,feedbackTime-dt);
    playerImpact=Math.max(0,playerImpact-dt);
    wallCooldown=Math.max(0,wallCooldown-dt);wallContact=null;
    dodgeCooldown=Math.max(0,dodgeCooldown-dt);
    zipCooldown=Math.max(0,zipCooldown-dt);
    if(zipTime>0){zipTime=Math.max(0,zipTime-dt);if(zipTime===0){zipEndedAt=elapsed;if(!rope && !webGrab)showWeb(false);}}
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
    updateChaos(dt);updateParticles(dt);updateBosses(dt);updateActivities(dt);updateHero(dt);updatePolice(dt);updateHints(dt);updateAreas(dt);slapCooldown=Math.max(0,slapCooldown-dt);slapAnimation=Math.max(0,slapAnimation-dt);slapChainTimer=Math.max(0,slapChainTimer-dt);screenShake=Math.max(0,screenShake-dt*2.5);updateMutators(dt);
    if(slapQueue>0){slapQueue=Math.max(0,slapQueue-dt);if(slapCooldown===0 && slapQueue>0){slapQueue=0;spiderSlap();}}
    jumpBuffer=Math.max(0,jumpBuffer-dt);coyoteTime=wasGrounded?.12:Math.max(0,coyoteTime-dt);
    if(input.lengthSq())input.normalize();
    // Solve the swing in small steps so arcs and reeling stay stable at different frame rates.
    const steps=Math.max(1,Math.ceil(dt/(1/120))),step=dt/steps;gatherPlayerNearActors();
    surfCar=null;wallRunning=false;
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
      const control=(onGround?(keys.sprint?64:36):rope?22:gliding?18:15)*(shockTime>0?.35:1)*(wading?.45:1);
      velocity.addScaledVector(steering,control*step);
      const drag=Math.exp(-(wading?5:onGround?4:rope?.025:gliding?0:.08)*step);
      velocity.x*=drag;velocity.z*=drag;
      if(onGround) {
        const horizontal=Math.hypot(velocity.x,velocity.z),limit=wading?3.5:keys.sprint?((progress.owned||[]).includes('sneakers')?21.5:18):9;
        if(horizontal>limit){const eased=limit+(horizontal-limit)*Math.exp(-3*step);velocity.x*=eased/horizontal;velocity.z*=eased/horizontal;}
      }
      velocity.y-=18*gravityScale*step;
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
        const reelAmount=Math.min(Math.max(automatic,keys.sprint?6*step:0),Math.max(0,oldLength-2));
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
      if(!onGround && speed>(gliding?75:55))velocity.multiplyScalar((gliding?75:55)/speed);
      onGround=false;
      const wet=waterAt(position.x,position.z),groundHeight=wet?wet.floor:parkElevation(position.x,position.z);
      if(position.y<=groundHeight){position.y=groundHeight;velocity.y=Math.max(0,velocity.y);onGround=true;}
      const playerCell=playerColliderCells.get(`${Math.floor(position.x/40)},${Math.floor(position.z/40)}`)||[];
      // Moving platforms (the subway train) are checked every step, outside the static grid.
      for(const list of [playerCell,movingColliders])for(const b of list) {
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
          else if(!onGround && !rope && !wallCooldown && wallRunTime<1.8 && b.height>8 && !b.shape && !insideBuilding(previous.x,previous.z,b,.4)) {
            // Running fast along a facade keeps you on the wall for a moment.
            const hitX=Math.abs(previous.x-b.x)>=b.w/2+.4,parallel=hitX?Math.abs(velocity.z):Math.abs(velocity.x);
            if(parallel>11) {
              wallContact=new THREE.Vector3(hitX?Math.sign(previous.x-b.x):0,0,hitX?0:Math.sign(previous.z-b.z));
              wallRunTime+=step;wallRunning=true;velocity.y=Math.max(velocity.y,-1.2);
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
      if(currentArea && position.y>currentArea.ceiling-1.8){position.y=currentArea.ceiling-1.8;velocity.y=Math.min(0,velocity.y);}
      if(onGround){wallRunTime=0;wallContact=null;}
      position.x=THREE.MathUtils.clamp(position.x,worldMinX,worldMaxX);position.z=THREE.MathUtils.clamp(position.z,worldMinZ,worldMaxZ);
    }
    bouncePlayer(wasGrounded,fallSpeed);
    if(onGround && jumpBuffer>0){jumpBuffer=0;jump();}
    updateAirTrick(dt,frameStart);
    if(!wasGliding && glideEngaged)playEffect('glide');
    if(!wasGrounded && onGround && previous.y-position.y>.01) {
      const surface=footstepSurface();playEffect(surface==='Stone'?'land':`land${surface}`);
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
      ambientSoundTime=9+Math.random()*9;
      const nearbyCar=cars.find(car=>car.group.visible && !car.stuck && car.group.position.distanceTo(position)<65);
      const nearbyBird=birds.find(bird=>bird.group.position.distanceTo(position)<65);
      if(nearbyBird && (!nearbyCar || Math.random()<.5))playEffect('bird',nearbyBird.group.position);
      else if(nearbyCar)playEffect('horn',nearbyCar.group.position);
    }
    footstepTime-=dt;
    if(onGround && input.lengthSq() && Math.hypot(velocity.x,velocity.z)>2 && footstepTime<=0) {
      playEffect(`step${footstepSurface()}`);footstepTime=keys.sprint?.27:.4;
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
    const blastShake=nuke?.phase==='blast'&&nuke.playerHit?Math.max(0,1-(nuke.time-nuke.playerHitAt)/5):0;
    const wallTilt=wallRunning && wallContact?THREE.MathUtils.clamp(wallContact.x*Math.cos(yaw)-wallContact.z*Math.sin(yaw),-1,1)*-.16:0;
    const targetRoll=(onGround?-lateral*.0015:THREE.MathUtils.clamp(-lateral*.0035,-.095,.095))+wallTilt + Math.sin(elapsed*14)*Math.min(playerImpact,1)*.24+Math.sin(elapsed*19)*blastShake*.07;
    cameraRoll+=(targetRoll*(settings.reduceMotion?.15:1)-cameraRoll)*(1-Math.exp(-4*dt));
    const targetFov=settings.fov+(settings.reduceMotion?0:Math.min(speed/38,1)*9+(rope?2:0))-(slowMotion?6:0);
    camera.fov+=(targetFov-camera.fov)*(1-Math.exp(-3*dt));camera.updateProjectionMatrix();
    const shake=screenShake*screenShake*.35;
    updateViewCamera(dt,bob,shake);
    handBlend+=(Number(Boolean(rope||webGrab||zipTime))-handBlend)*(1-Math.exp(-9*dt));
    const sway=Math.sin(elapsed*7)*Math.min(speed/25,1)*.025;
    const running=onGround&&!rope&&!webGrab?Math.min(speed/9,1):0;
    runBlend+=(running-runBlend)*(1-Math.exp(-10*dt));
    runPhase+=dt*(7+Math.min(speed,18)*.48);
    const stride=Math.sin(runPhase)*runBlend, lift=Math.cos(runPhase*2)*runBlend;
    updateHeroPose(dt);
    bombAnimation=Math.max(0,bombAnimation-dt);
    const shot=Math.sin(Math.PI*(1-bombAnimation/.38))*(bombAnimation>0?1:0);
    rightHand.position.set(.47-handBlend*.16+sway-stride*.035-shot*.13,-.59+handBlend*.25+bob+stride*.10+lift*.025+shot*.15,-1.0-handBlend*.08+stride*.13-shot*.28);
    rightHand.rotation.set(-handBlend*.28+velocity.y*.002-stride*.20-shot*.32,shot*.08,handBlend*.12-cameraRoll*.5-stride*.07);
    leftHand.position.set(-.47+sway+stride*.035,-.59+bob*1.5+(rope?.06:0)-stride*.10+lift*.025,-1.0-stride*.13);
    leftHand.rotation.set((rope?-.2:0)+stride*.20,0,-cameraRoll*.5+stride*.07);
    if(slapAnimation>0) {
      // Backhand sweep across the view.
      const t=1-slapAnimation/.3,swingArc=Math.sin(Math.PI*t);
      const hand=slapChain===2?rightHand:leftHand,side=slapChain===2?-1:1;
      hand.position.x+=side*(.75*t-.15);hand.position.y+=.25*swingArc;hand.position.z-=.35*swingArc;hand.rotation.z-=side*1.1*swingArc;hand.rotation.y-=side*.6*swingArc;
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
    updateAmbientAudio();
    updatePopups(dt);updateSpeedLines(dt,velocity.length());
    if(reticle) {reticle.classList.toggle('active',Boolean(rope||webGrab));reticle.classList.toggle('missed',feedbackTime>0);}
    sky.position.copy(camera.position);sky.material.uniforms.altitude.value=position.y; updateEnvironment(dt);sun.position.copy(position).addScaledVector(sunDir,150); sun.target.position.copy(position); sun.target.updateMatrixWorld();
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
  mapPaint.fillStyle='#496d52';mapRect(-200,-680,200,-480);
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
  mapRect(-185,1185,-115,1245);mapRect(277,4,321,40);
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
  for(const [label,x,z] of [['NORTH END',0,-580],['HARLEM',0,-460],['UPPER WEST SIDE',-170,-60],['UPPER EAST SIDE',140,-140],['CENTRAL PARK',-20,0],['MIDTOWN',-150,330],['TIMES SQ',60,220],['EMPIRE STATE',60,300],
    ['CHRYSLER',140,260],['FLATIRON',20,460],['THE VILLAGE',-120,560],['WASHINGTON SQ',20,540],['FINANCIAL DISTRICT',40,800],['WORLD TRADE',-160,700],['BATTERY PARK',0,970],['WATERFRONT',211,-26],
    ['BROOKLYN BRIDGE',300,bridgeZ-14],['DUMBO',430,790],['DOWNTOWN BROOKLYN',480,520],['BROOKLYN',640,900],['CONEY ISLAND',600,1085],['LIBERTY ISLAND',-150,1215],['SCHOOL',-180,-20],['HOSPITAL',140,20],['BANK',-140,140],['GROCERY',140,140]])mapLabel(mapPaint,label,x,z);
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
    for(const cop of cops)if(cop.active && !cop.defeated){const x=mapX(cop.group.position.x)+offsetX,y=mapY(cop.group.position.z)+offsetY;if(x>0&&x<320&&y>0&&y<320){mapContext.fillStyle='#5b8cff';mapContext.fillRect(x-2.5,y-2.5,5,5);}}
    for(const car of cruisers)if(car.active){const x=mapX(car.group.position.x)+offsetX,y=mapY(car.group.position.z)+offsetY;if(x>0&&x<320&&y>0&&y<320){mapContext.fillStyle=Math.floor(elapsed*6)%2?'#ff4d4d':'#5b8cff';mapContext.fillRect(x-4,y-4,8,8);}}
    for(const [point,color,label] of [[crime?{x:crime.x,z:crime.z}:null,'#ff4d4d','!'],[storyTarget,'#ffd25e','★']]) {
      if(!point)continue;
      const x=THREE.MathUtils.clamp(mapX(point.x)+offsetX,12,308),y=THREE.MathUtils.clamp(mapY(point.z)+offsetY,12,308);
      mapContext.fillStyle=color;mapContext.strokeStyle='#211914';mapContext.lineWidth=2;mapContext.beginPath();mapContext.arc(x,y,8,0,Math.PI*2);mapContext.fill();mapContext.stroke();
      mapContext.fillStyle='#211914';mapContext.font='bold 12px Arial';mapContext.textAlign='center';mapContext.textBaseline='middle';mapContext.fillText(label,x,y+.5);
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
  const hudButton=document.getElementById('hud-toggle');let hudMinimal=false;
  try{hudMinimal=localStorage.getItem('spida.hud')==='minimal';}catch(_){/* Default to the full HUD. */}
  function applyHud(){document.querySelector('.game-shell').classList.toggle('hud-minimal',hudMinimal);if(hudButton)hudButton.textContent=`HUD: ${hudMinimal?'Minimal':'Full'}`;}
  hudButton?.addEventListener('click',()=>{hudMinimal=!hudMinimal;try{localStorage.setItem('spida.hud',hudMinimal?'minimal':'full');}catch(_){/* Session only. */}applyHud();});
  applyHud();
  const graphicsButton=document.getElementById('graphics-toggle');
  function updateGraphicsButton(){if(graphicsButton)graphicsButton.textContent=`Graphics: ${graphicsProfiles[graphicsQuality].label}`;}
  if(graphicsButton)graphicsButton.addEventListener('click',()=>{
    const choices=Object.keys(graphicsProfiles);graphicsQuality=choices[(choices.indexOf(graphicsQuality)+1)%choices.length];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,graphicsProfiles[graphicsQuality].pixelRatio));renderer.setSize(innerWidth,innerHeight);
    particleMaterial.uniforms.viewport.value=innerHeight*renderer.getPixelRatio();shadowTime=0;
    try{localStorage.setItem('spida.graphics',graphicsQuality);}catch(_){}
    updateSceneDetail(true);updateCityLod(0,true);updateGraphicsButton();
  });
  updateGraphicsButton();
  function setPaused(value,lockLost=false) {
    if(paused===value)return;
    paused=value;pauseMenu.hidden=!value;document.querySelector('.game-shell').classList.toggle('is-paused',value);syncEffectsBus();
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
  function drawFrame(dt) {
    drawMinimap(dt);shadowTime-=dt;if(shadowTime<=0){renderer.shadowMap.needsUpdate=true;shadowTime=graphicsProfiles[graphicsQuality].shadowInterval;}
    renderer.clear();renderer.render(scene,camera);if(cameraMode==='first'||cameraNear){renderer.clearDepth();renderer.render(handsScene,handsCamera);}
  }
