  // Deterministic stepping is available to automated playtests; normal play uses RAF.
  const manualTest=new URLSearchParams(location.search).has('test');
  window.advanceTime=ms=>{
    const steps=Math.max(1,Math.ceil(ms/(1000/60))),dt=ms/1000/steps;
    if(!paused)for(let i=0;i<steps;i++)update(dt);
    drawFrame(ms/1000);
  };
  window.render_game_to_text=()=>JSON.stringify({
    coordinates:'x east, y up, z south; world units',mode:paused?'paused':koTimer>0?'knocked-out':'playing',
    player:{x:+position.x.toFixed(2),y:+position.y.toFixed(2),z:+position.z.toFixed(2),
      vx:+velocity.x.toFixed(2),vy:+velocity.y.toFixed(2),vz:+velocity.z.toFixed(2),grounded:onGround,swinging:Boolean(rope),gliding:glideEngaged,holding:Boolean(webGrab),health:Math.round(playerHp),camera:cameraMode},
    district:districtName(position.x,position.z),chaos:chaosScore,combo:comboHits,finisherReady,
    nuke:nuke?{phase:nuke.phase,time:+nuke.time.toFixed(2),radius:+nuke.radius.toFixed(2),playerHit:nuke.playerHit}:null,
    crime:crime?{type:crime.type.name,x:crime.x,z:crime.z,remaining:crime.members.filter(a=>!a.defeated).length}:null,
    rescue:rescue?{type:rescue.type,result:rescue.result,x:+rescue.actor.group.position.x.toFixed(1),z:+rescue.actor.group.position.z.toFixed(1)}:null,
    cityEvent:cityEvent?{type:cityEvent.type,time:+cityEvent.time.toFixed(1)}:null,
    galleries:targetGalleries.filter(g=>Math.hypot(g.x-position.x,g.z-position.z)<80 && !g.owner?.destroyed).map(g=>({x:g.x,y:g.y,z:g.z,hit:g.targets.filter(t=>t.lit).length,total:g.targets.length})),
    nearby:pedestrians.filter(a=>a.group.visible&&!a.dead&&a.group.position.distanceToSquared(position)<20*20).slice(0,8).map(a=>({x:+a.group.position.x.toFixed(1),y:+a.group.position.y.toFixed(1),z:+a.group.position.z.toFixed(1),type:a.thug||a.role||'pedestrian',flying:Boolean(a.knockback),webbed:Boolean(a.stuck)})),
    bosses:bosses.filter(b=>b.status==='active').map(b=>({name:b.name,hp:+b.hp.toFixed(1),x:+b.actor.group.position.x.toFixed(1),z:+b.actor.group.position.z.toFixed(1)}))
  });
  // Opt-in test hook for automated playtesting: open the game with ?debug.
  if(new URLSearchParams(location.search).has("debug"))window.__spida={trainState:()=>({z:train.z,state:train.state,surfing:train.surfing,onRoof:onTrainRoof(),area:currentArea?.name}),setTime:hour=>{dayHour=hour;},setWeather:next=>{setWeather(next);weather=next;precipitation=next==='clear'?0:1;overcast=next==='clear'?0:.85;},renderer,scene,camera,hero,grappleMeshes,buildings,playerBuildingColliders,position,velocity,keys,pedestrians,cars,chargeProps,tethers,bosses,progress,mutators,raceCourses,pizzaSpots,bouncePads,pressureTanks,targetGalleries,beginWebAction,endWebAction,jump,dodge,spiderSlap,fireBomb,webZip,hitPlayer,activateBoss,launchNuke,setMutator,setCameraMode,startCityEvent,clearCityEvent,reset,
    step:dt=>{if(!paused)update(dt);},updateViewCamera,poseWalkingArms,pedestrianHandPoint,fleeDanger,updateThug,updateKnockback,enemyProjectiles,detonateNuke,updateNuke,
    nukeState:()=>nuke?{phase:nuke.phase,time:nuke.time,radius:nuke.radius,target:nuke.target.clone(),playerHit:nuke.playerHit,playerHitAt:nuke.playerHitAt,blackout,waveOpacity:nuke.wave?.material.opacity??0,windOpacity:Number(blastWind.style.opacity)||0}:null,
    look:(y,p)=>{yaw=y;pitch=p;},teleport:(x,y,z)=>{position.set(x,y,z);velocity.set(0,0,0);onGround=false;},
    tick:(seconds,dt=1/60)=>{for(let t=0;t<seconds;t+=dt)update(dt);renderer.shadowMap.needsUpdate=true;drawFrame(seconds);},
    audioState:()=>({context:soundContext?.state||'locked',enabled:effectsEnabled,paused,foleyLoaded:Boolean(foleyBuffer)||fallbackSound,windLoaded:Boolean(windBuffer),engineLoaded:Boolean(engineBuffer),nukeFallActive:Boolean(nukeFallTone),nukeFallMuted:nukeFallTone instanceof HTMLMediaElement?nukeFallTone.muted:null,surface:footstepSurface(),played:soundStats.played,active:activeSounds.size+fallbackVoices.size,last:soundStats.last,recent:[...soundStats.recent],errors:[...soundStats.errors],bus:effectsBus?.gain.value??null,windGain:windGain?.gain.value??null,engineGain:engineGain?.gain.value??null}),
    playEffect,playVoice,audioNodes:()=>({context:soundContext,bus:effectsBus}),
    state:()=>({rope:Boolean(rope),onGround,speed:velocity.length(),chaosScore,comboPoints,opinion,anchor:rope?.anchor,slapChain,slapCooldown,dodgeCooldown,padCooldown,camera:cameraMode,cameraNear,viewDistance,airTrick:airTrick?{...airTrick}:null,cityEvent:cityEvent?.type||null,nuke:nuke?.phase||null})};
  applySuit(progress.suit);updateHeroHud();buildSettingsUi();
  for(const b of playerBuildingColliders) {
    const minX=Math.floor((b.x-b.w/2-1)/40),maxX=Math.floor((b.x+b.w/2+1)/40),minZ=Math.floor((b.z-b.d/2-1)/40),maxZ=Math.floor((b.z+b.d/2+1)/40);
    for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){const key=`${x},${z}`;if(!playerColliderCells.has(key))playerColliderCells.set(key,[]);playerColliderCells.get(key).push(b);}
  }
  reset();updateSceneDetail(true);updateCityLod(0,true);showTitleReady();if(manualTest)drawFrame(0);else requestAnimationFrame(frame);
})();

