  // A two-tone siren follows the nearest cruiser.
  let siren=null;
  function updateSiren() {
    if(!soundContext || soundContext.state!=='running')return;
    const near=cruisers.filter(c=>c.active).map(c=>c.group.position.distanceTo(position)).sort((a,b)=>a-b)[0];
    if(near===undefined){if(siren){siren.gain.gain.setTargetAtTime(0,soundContext.currentTime,.2);}return;}
    if(!siren) {
      const tone=soundContext.createOscillator(),wobble=soundContext.createOscillator(),depth=soundContext.createGain(),gain=soundContext.createGain();
      tone.type='triangle';tone.frequency.value=720;wobble.frequency.value=.55;depth.gain.value=230;wobble.connect(depth);depth.connect(tone.frequency);
      gain.gain.value=0;tone.connect(gain);gain.connect(effectsBus);tone.start();wobble.start();siren={tone,wobble,gain};
    }
    siren.gain.gain.setTargetAtTime(Math.max(0,1-near/120)*.035,soundContext.currentTime,.2);
  }
  function updatePolice(dt) {
    if(titleOpen)return;
    heatHold=Math.max(0,heatHold-dt);
    const heliPos=policeHeli.group.position;
    spotted=heat>0 && (cops.some(c=>c.active && !c.defeated && c.group.position.distanceToSquared(position)<45*45)||cruisers.some(c=>c.active && c.group.position.distanceToSquared(position)<45*45)||(policeHeli.active && Math.hypot(heliPos.x-position.x,heliPos.z-position.z)<40));
    if(heat>0 && (spotted || heatHold>0))lastSeen.copy(position);
    const pursuit=spotted;
    if(heatHold<=0 && heat>0){heat=Math.max(0,heat-dt*(spotted?.03:.25)*((progress.owned||[]).includes('lawyer')?2:1));updateHeatHud();}
    heatHud?.classList.toggle('pursuit',pursuit && heat>0);
    const level=stars(),wantCops=[0,2,4,5,6,8][level];
    const activeCops=cops.filter(c=>c.active);
    copSpawnTimer-=dt;
    if(activeCops.filter(c=>!c.defeated).length<wantCops && copSpawnTimer<=0){const idle=cops.find(c=>!c.active);if(idle && deployCop(idle))copSpawnTimer=.8;}
    // Once the heat is gone, officers stand down and leave as soon as they are out of view range.
    if(level===0){for(const cop of activeCops)if(cop.defeated || cop.group.position.distanceToSquared(position)>30*30)retireCop(cop);}
    cruisers.forEach((car,i)=>{
      const want=level>=2 && i<(level>=4?2:1);
      if(want && !car.active){const spot=policeSpot(70,100);if(spot){car.active=true;car.group.position.set(spot.x,0,spot.z);car.heading=Math.atan2(position.x-spot.x,position.z-spot.z);car.speed=0;}}
      else if(!want && car.active && car.group.position.distanceTo(position)>40)car.active=false;
      updateCruiser(car,dt);
    });
    policeHeli.active=level>=3;updateHeli(dt);updateSiren();
  }
  function clearPolice() {heat=0;heatHold=0;for(const cop of cops)retireCop(cop);for(const car of cruisers){car.active=false;car.group.visible=false;}policeHeli.active=false;policeHeli.group.visible=false;policeHeli.beam.visible=false;updateHeatHud();}
  // ---- First-time hints: one short prompt at a time, each shown once ----
  const hintBox=document.getElementById('hint'),touchDevice=matchMedia('(pointer: coarse)').matches;
  let hintsSeen=new Set();try{hintsSeen=new Set(JSON.parse(localStorage.getItem('spida.hints')||'[]'));}catch(_){/* Show hints again this session. */}
  let activeHint=null,hintCheck=0,playTime=0;
  const hints=[
    {id:'swing',when:()=>playTime>2 && !rope,text:touchDevice?'Hold the swing button while aiming at a building':'Hold left click while aiming at a building to swing',done:()=>rope},
    {id:'reel',when:()=>rope && rope.age>.8,text:touchDevice?'Sprint reels the web in. Jump lets go.':'Shift reels the web in. Space lets go with a jump.',done:()=>!rope},
    {id:'zip',when:()=>!onGround && !rope && position.y>14 && hintsSeen.has('swing'),text:touchDevice?'The arrow button zips to where you aim':'E zips to where you aim. Hold Shift in the air to glide.',done:()=>zipTime>0||glideEngaged},
    {id:'slap',when:()=>pedestrians.some(n=>!n.dead && n.group.visible && n.group.position.distanceToSquared(position)<16),text:touchDevice?'The hand button slaps. The star fires a web bomb.':'F slaps. Right click fires a web bomb.',done:()=>slapAnimation>0},
    {id:'grab',when:()=>playTime>45 && hintsSeen.has('slap'),text:touchDevice?'Hold swing on a person or car to grab it, then let go aiming at a wall':'Hold left click on a person or car to grab it. Release aiming at a wall to stick it there.',done:()=>webGrab},
    {id:'crime',when:()=>crime && playTime>12,text:'A red beacon marks a crime in progress. Defeat the crooks.',done:()=>!crime||Math.hypot(crime.x-position.x,crime.z-position.z)<25},
    {id:'sense',when:()=>senseTimer>0,text:touchDevice?'Red edges mean an attack is coming. Tap dodge.':'Red edges mean an attack is coming. Press C to dodge.',done:()=>dodgeCooldown>0},
    {id:'boss',when:()=>focusBoss||bosses.some(b=>b.status==='active' && b.actor.group.position.distanceToSquared(position)<60*60),text:'Bosses: webs stun them, and thrown people and cars hit hardest. Rhino is weak from behind.'},
    {id:'heat',when:()=>stars()>0,text:'The police are after you. Stay out of their sight to lose them.',done:()=>stars()===0},
    {id:'health',when:()=>playerHp<45,text:'Get clear of the fight for a moment to recover health.'},
    {id:'level',when:()=>progress.level>=2,text:touchDevice?'Leveling up unlocks abilities. Suits are in the pause menu.':'Leveling up unlocks abilities. Suits are in the pause menu (Esc).'},
    {id:'camera',when:()=>playTime>70 && !touchDevice,text:'V switches between first and third person.'},
    {id:'details',when:()=>playTime>110 && !touchDevice,text:'Hold Tab to see villains, collectibles and progress.'}
  ];
  function updateHints(dt) {
    if(!hintBox || titleOpen)return;
    playTime+=dt;
    if(activeHint) {
      activeHint.time+=dt;
      if(activeHint.time>8 || (activeHint.time>.8 && activeHint.done?.())){hintBox.classList.remove('show');activeHint=null;hintCheck=1.2;}
      return;
    }
    hintCheck-=dt;if(hintCheck>0)return;hintCheck=.5;
    const next=hints.find(hint=>!hintsSeen.has(hint.id) && hint.when());
    if(!next)return;
    hintsSeen.add(next.id);try{localStorage.setItem('spida.hints',JSON.stringify([...hintsSeen]));}catch(_){/* Session only. */}
    activeHint={...next,time:0};hintBox.textContent=next.text;hintBox.hidden=false;hintBox.classList.add('show');
  }
  // ---- Player settings: look, field of view, volume, motion and key bindings ----
  const settings={sensitivity:1,fov:72,music:.8,effects:1,invert:false,reduceMotion:false};
  try{Object.assign(settings,JSON.parse(localStorage.getItem('spida.settings')||'{}'));}catch(_){/* Defaults. */}
  const defaultKeys={interact:'KeyG',zip:'KeyE',slap:'KeyF',dodge:'KeyC',camera:'KeyV',slowmo:'KeyT',photo:'KeyP',nuke:'KeyN',reset:'KeyR'};
  const keyLabels={interact:'Interact',zip:'Web zip',slap:'Spider-slap',dodge:'Dodge',camera:'Switch camera',slowmo:'Slow motion',photo:'Photo mode',nuke:'Nuke',reset:'Reset'};
  let keyBindings={...defaultKeys};
  try{Object.assign(keyBindings,JSON.parse(localStorage.getItem('spida.keys')||'{}'));}catch(_){/* Defaults. */}
  function saveSettings(){try{localStorage.setItem('spida.settings',JSON.stringify(settings));localStorage.setItem('spida.keys',JSON.stringify(keyBindings));}catch(_){/* Session only. */}}
  // Rebound keys are translated back to the default codes the input handlers expect.
  function remapKey(code) {
    for(const [action,key] of Object.entries(keyBindings))if(key===code)return defaultKeys[action];
    return Object.values(defaultKeys).includes(code)?'':code;
  }
  const keyName=code=>code.replace(/^Key/,'').replace(/^Digit/,'').replace('ShiftLeft','L-Shift').replace('ControlLeft','L-Ctrl');
  function buildSettingsUi() {
    for(const [id,key,format] of [['set-sensitivity','sensitivity',v=>`${(+v).toFixed(1)}×`],['set-fov','fov',v=>`${v}°`],['set-music','music',v=>`${Math.round(v*100)}%`],['set-effects','effects',v=>`${Math.round(v*100)}%`]]) {
      const input=document.getElementById(id);if(!input)continue;const output=input.nextElementSibling;
      input.value=settings[key];output.textContent=format(input.value);
      input.addEventListener('input',()=>{settings[key]=+input.value;output.textContent=format(input.value);saveSettings();applyVolumes();});
    }
    for(const [id,key] of [['set-invert','invert'],['set-motion','reduceMotion']]) {
      const input=document.getElementById(id);if(!input)continue;input.checked=settings[key];
      input.addEventListener('change',()=>{settings[key]=input.checked;saveSettings();});
    }
    const list=document.getElementById('bindings');if(!list)return;
    list.innerHTML='';
    for(const action of Object.keys(defaultKeys)) {
      const row=document.createElement('div'),button=document.createElement('button');button.type='button';button.textContent=keyName(keyBindings[action]);
      row.append(keyLabels[action],button);list.appendChild(row);
      button.addEventListener('click',()=>{
        // The next key pressed becomes the binding; Escape cancels.
        button.classList.add('listening');button.textContent='Press a key';
        const capture=event=>{
          event.preventDefault();event.stopImmediatePropagation();window.removeEventListener('keydown',capture,true);button.classList.remove('listening');
          if(event.code!=='Escape'){for(const other of Object.keys(keyBindings))if(keyBindings[other]===event.code)keyBindings[other]=keyBindings[action];keyBindings[action]=event.code;saveSettings();}
          buildSettingsUi();
        };
        window.addEventListener('keydown',capture,true);
      });
    }
  }
  function applyVolumes() {
    if(!soundContext)return;
    if(musicBus)musicBus.gain.setTargetAtTime(musicEnabled?settings.music:0,soundContext.currentTime,.05);
    syncEffectsBus();
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
  let windGain=null,windFilter=null,musicBus=null,effectsBus=null,effectsEnabled=true,footstepTime=0,ambientSoundTime=3;
  const effectsToggle=document.getElementById('effects-toggle');
  effectsToggle.addEventListener('click',()=>{
    effectsEnabled=!effectsEnabled;
    effectsToggle.textContent=`Sound effects: ${effectsEnabled?'On':'Off'}`;
    effectsToggle.setAttribute('aria-pressed',String(effectsEnabled));
    syncEffectsBus();
    for(const audio of [nukeBoom,nukeScreams,nukeCrowdLayer])if(audio)audio.muted=!effectsEnabled;
  });
  // The one-shot recordings share a compact sprite; offsets are in decoded seconds.
  const foleyClips={"stone1":[0.0,0.3729],"stone2":[0.4629,0.32261],"stone3":[0.87551,0.33093],"grass1":[1.29644,0.44254],"grass2":[1.82898,0.34018],"grass3":[2.25916,0.29952],"water1":[2.64868,0.4],"water2":[3.13868,0.44673],"water3":[3.67542,0.43483],"swish1":[4.20025,0.27683],"swish2":[4.56707,0.41551],"swish3":[5.07259,0.29816],"swish4":[5.46075,0.39522],"hit1":[5.94596,0.58288],"hit2":[6.61884,0.34011],"hit3":[7.04896,0.66469],"hit4":[7.80365,0.54213],"metal1":[8.43578,0.51676],"metal2":[9.04254,0.41463],"wet1":[9.54717,0.31449],"wet2":[9.95166,0.30435],"splash1":[10.34601,0.83005],"splash2":[11.26605,0.56859],"grunt1":[11.92465,0.4105],"grunt2":[12.42515,0.46501],"grunt3":[12.98016,0.81887],"grunt4":[13.88902,0.62839],"grunt5":[14.60741,0.43717],"scream1":[15.13458,1.46349],"scream2":[16.68807,0.96603],"horn1":[17.7441,1.35084],"horn2":[19.18494,0.45785],"bird1":[19.73279,3.0],"bird2":[22.82279,3.0],"crash":[25.91279,1.22361],"spark":[27.22639,0.19492],"chime1":[27.51132,0.67939],"chime2":[28.2807,0.31184]};
  const soundSets={
    stone:['stone1','stone2','stone3'],grass:['grass1','grass2','grass3'],water:['water1','water2','water3'],
    swish:['swish1','swish2','swish3','swish4'],hit:['hit1','hit2','hit3','hit4'],metal:['metal1','metal2'],
    wet:['wet1','wet2'],splash:['splash1','splash2'],grunt:['grunt1','grunt2','grunt3','grunt4','grunt5'],
    scream:['scream1','scream2'],horn:['horn1','horn2'],bird:['bird1','bird2'],crash:['crash'],spark:['spark'],chime:['chime1','chime2']
  };
  const soundLimits={grunt:.32,scream:1.8,horn:2,bird:2.4,crash:.12};
  const soundFiles={foley:'assets/audio/foley.mp3',wind:'assets/audio/wind-rush.mp3',engine:'assets/audio/car-engine.mp3'};
  // Fetch while the city loads, but create and decode the audio context only after a gesture.
  const soundBytes=location.protocol==='file:'?null:Object.fromEntries(Object.entries(soundFiles).map(([name,url])=>[name,
    fetch(url).then(response=>response.ok?response.arrayBuffer():null).catch(()=>null)]));
  let foleyBuffer=null,windBuffer=null,engineBuffer=null,soundLoading=false,fallbackSound=location.protocol==='file:';
  let engineGain=null,enginePan=null,engineSource=null,fileWind=null,fileEngine=null;
  const soundLastChoice={},soundLastTime={},activeSounds=new Set(),fallbackVoices=new Set(),pendingSounds=[];
  const soundStats={played:0,last:null,recent:[],errors:[]};
  function syncEffectsBus() {
    const audible=effectsEnabled && !paused && !document.hidden;
    if(effectsBus && soundContext)effectsBus.gain.setTargetAtTime(audible?settings.effects:0,soundContext.currentTime,.025);
    for(const audio of [fileWind,fileEngine])if(audio)audio.muted=!audible;
    if(nukeFallTone instanceof HTMLMediaElement)nukeFallTone.muted=!audible;
    if(!audible)for(const audio of [...fallbackVoices])audio.effectStop();
  }
  function soundSpace(source) {
    if(!source)return {distance:0,volume:1,pan:0};
    const dx=source.x-position.x,dy=source.y-position.y,dz=source.z-position.z,distance=Math.hypot(dx,dy,dz);
    const volume=distance>=130?0:Math.pow(1-distance/130,2)/(1+distance/45);
    const pan=THREE.MathUtils.clamp((dx*Math.cos(yaw)-dz*Math.sin(yaw))/Math.max(1,distance),-1,1)*Math.min(1,distance/8);
    return {distance,volume,pan};
  }
  function soundChoice(set) {
    const choices=soundSets[set];if(!choices?.length)return null;
    let index=Math.floor(Math.random()*choices.length);
    if(choices.length>1 && index===soundLastChoice[set])index=(index+1+Math.floor(Math.random()*(choices.length-1)))%choices.length;
    soundLastChoice[set]=index;return choices[index];
  }
  function recordSound(set,clip,space,level,rate) {
    soundStats.played++;soundStats.last={set,clip,distance:space.distance,pan:space.pan,level,rate};soundStats.recent.push(soundStats.last);if(soundStats.recent.length>24)soundStats.recent.shift();
  }
  function playSample(set,source,volume=1,rate=1,delay=0) {
    const space=soundSpace(source);if(space.volume<.002)return;
    const now=soundContext.currentTime;
    if(now-(soundLastTime[set]??-100)<(soundLimits[set]||0))return;
    // Retire the oldest sound when a chaotic crowd fills the mixer, so a fresh hit or step is never dropped.
    if(activeSounds.size+fallbackVoices.size>=24) {
      if(activeSounds.size){const oldest=activeSounds.values().next().value;activeSounds.delete(oldest);try{const gain=oldest.effectLevel;gain.cancelScheduledValues(now);gain.setValueAtTime(gain.value,now);gain.linearRampToValueAtTime(0,now+.01);oldest.stop(now+.012);}catch(_){}}
      else fallbackVoices.values().next().value.effectStop();
    }
    const clip=soundChoice(set),segment=foleyClips[clip];if(!segment)return;
    soundLastTime[set]=now;
    const playbackRate=rate*(.96+Math.random()*.08),level=volume*space.volume;
    if(fallbackSound) {
      // Direct media playback keeps file:// launches working without Web Audio CORS access.
      const audio=new Audio(soundFiles.foley);fallbackVoices.add(audio);audio.preload='auto';audio.volume=Math.min(1,level);audio.playbackRate=playbackRate;
      let finished=false,timer=null;
      const done=()=>{if(finished)return;finished=true;if(timer)clearTimeout(timer);audio.pause();fallbackVoices.delete(audio);};
      audio.effectStop=done;audio.addEventListener('error',done,{once:true});
      audio.addEventListener('loadedmetadata',()=>{
        if(finished || !effectsEnabled || paused || document.hidden){done();return;}
        audio.currentTime=segment[0];const start=()=>{
          if(finished || !effectsEnabled || paused || document.hidden){done();return;}
          audio.play().then(()=>{if(finished){audio.pause();return;}recordSound(set,clip,space,level,playbackRate);timer=setTimeout(done,segment[1]/playbackRate*1000);}).catch(done);
        };
        if(delay>0)timer=setTimeout(start,delay*1000);else start();
      },{once:true});
      return;
    }
    if(!foleyBuffer)return;
    const at=now+delay,end=at+segment[1]/playbackRate;
    const player=soundContext.createBufferSource(),envelope=soundContext.createGain(),filter=soundContext.createBiquadFilter();
    player.buffer=foleyBuffer;player.playbackRate.value=playbackRate;filter.type='lowpass';filter.frequency.value=Math.max(1800,18000/(1+space.distance/30));
    envelope.gain.setValueAtTime(0,at);envelope.gain.linearRampToValueAtTime(level,at+.004);
    envelope.gain.setValueAtTime(level,Math.max(at+.005,end-.025));envelope.gain.linearRampToValueAtTime(0,end);
    player.connect(filter);filter.connect(envelope);
    if(soundContext.createStereoPanner){const panner=soundContext.createStereoPanner();panner.pan.value=space.pan;envelope.connect(panner);panner.connect(effectsBus);}
    else envelope.connect(effectsBus);
    player.effectLevel=envelope.gain;activeSounds.add(player);player.onended=()=>activeSounds.delete(player);
    player.start(at,segment[0],segment[1]);recordSound(set,clip,space,level,playbackRate);
  }
  function flushPendingSounds() {
    if((!foleyBuffer && !fallbackSound) || !soundContext || soundContext.state!=='running')return;
    const queued=pendingSounds.splice(0),now=performance.now();
    for(const event of queued)if(now-event.time<450)playEffect(event.kind,event.source);
  }
  function startSoundLoops() {
    if(!soundContext || !effectsBus)return;
    if(windBuffer && !windGain) {
      const player=soundContext.createBufferSource();player.buffer=windBuffer;player.loop=true;
      windFilter=soundContext.createBiquadFilter();windFilter.type='lowpass';windFilter.frequency.value=1000;
      windGain=soundContext.createGain();windGain.gain.value=0;player.connect(windFilter);windFilter.connect(windGain);windGain.connect(effectsBus);player.start();
    }
    if(engineBuffer && !engineSource) {
      engineSource=soundContext.createBufferSource();engineSource.buffer=engineBuffer;engineSource.loop=true;
      const filter=soundContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1600;
      engineGain=soundContext.createGain();engineGain.gain.value=0;engineSource.connect(filter);filter.connect(engineGain);
      if(soundContext.createStereoPanner){enginePan=soundContext.createStereoPanner();engineGain.connect(enginePan);enginePan.connect(effectsBus);}else engineGain.connect(effectsBus);
      engineSource.start();
    }
    if(fallbackSound && location.protocol==='file:' && !fileWind) {
      fileWind=new Audio(soundFiles.wind);fileEngine=new Audio(soundFiles.engine);
      for(const audio of [fileWind,fileEngine]){audio.loop=true;audio.volume=0;audio.muted=!effectsEnabled || paused;audio.play().catch(()=>{});}
    }
  }
  function loadSoundAssets() {
    if(soundLoading)return;soundLoading=true;
    if(!soundBytes){startSoundLoops();flushPendingSounds();return;}
    for(const [name,promise] of Object.entries(soundBytes))promise.then(bytes=>{
      if(!bytes)throw new Error(`Could not load ${name}`);
      return soundContext.decodeAudioData(bytes);
    }).then(buffer=>{
      if(name==='foley'){foleyBuffer=buffer;flushPendingSounds();}
      else if(name==='wind')windBuffer=buffer;else engineBuffer=buffer;
      startSoundLoops();
    }).catch(()=>{
      soundStats.errors.push(name);
      if(name==='foley'){fallbackSound=true;startSoundLoops();flushPendingSounds();}
    });
  }
  function footstepSurface() {
    const wet=waterAt(position.x,position.z);
    if(wet && position.y<wet.surface+.3)return 'Water';
    const x=position.x,z=position.z;
    if(!inPark(x,z) || position.y>=parkElevation(x,z)+1.2)return 'Stone';
    // The park contains paved trails and a long stone mall among the lawns.
    const outer=Math.hypot((x+20)/49,z/183),reservoir=Math.hypot((x+20)/36,(z+70)/43);
    if((outer>=.955 && outer<=1) || (reservoir>=.91 && reservoir<=1) || (Math.abs(x-8)<2.5 && z>83 && z<161) || (Math.abs(x-8)<6 && Math.abs(z-82)<5))return 'Stone';
    for(const trail of parkSoundTrails)for(let i=1;i<trail.samples.length;i++) {
      const a=trail.samples[i-1],b=trail.samples[i],dx=b.x-a.x,dz=b.z-a.z;
      const t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);
      if((x-a.x-dx*t)**2+(z-a.z-dz*t)**2<(trail.width/2)**2)return 'Stone';
    }
    return 'Grass';
  }
  function updateAmbientAudio() {
    if(!soundContext)return;
    const rush=THREE.MathUtils.smoothstep(velocity.length(),9,65),now=soundContext.currentTime;
    if(windGain){windGain.gain.setTargetAtTime(rush*.30,now,.16);windFilter.frequency.setTargetAtTime(650+rush*5000,now,.2);}
    if(fileWind)fileWind.volume=effectsEnabled&&!paused?rush*.22:0;
    let nearest=null,best=65*65;
    for(const car of cars)if(car.group.visible){const d=car.group.position.distanceToSquared(position);if(d<best){nearest=car;best=d;}}
    const space=nearest?soundSpace(nearest.group.position):{volume:0,pan:0};
    const volume=space.volume*.14,engineRate=.8+Math.min(1,Math.abs(nearest?.currentSpeed||0)/25)*.35;
    if(engineGain){engineGain.gain.setTargetAtTime(volume,now,.35);engineSource.playbackRate.setTargetAtTime(engineRate,now,.4);if(enginePan)enginePan.pan.setTargetAtTime(space.pan,now,.3);}
    if(fileEngine){fileEngine.volume=effectsEnabled&&!paused?Math.min(1,volume):0;fileEngine.playbackRate=engineRate;}
  }
  // Layer real-world foley into distinct web, combat, movement and city cues.
  function playEffect(kind,source=null) {
    if(!effectsEnabled || !soundContext || document.hidden || paused)return;
    if((!foleyBuffer && !fallbackSound) || soundContext.state!=='running') {
      if(pendingSounds.length>=8)pendingSounds.shift();
      pendingSounds.push({kind,source:source?{x:source.x,y:source.y,z:source.z}:null,time:performance.now()});return;
    }
    const sample=(set,gain,rate=1,delay=0)=>playSample(set,source,gain,rate,delay);
    switch(kind) {
      case 'step':case 'stepStone':sample('stone',.25);break;
      case 'stepGrass':sample('grass',.33);break;
      case 'stepWater':sample('water',.33,1.15);break;
      case 'jump':if(onGround)sample(({Stone:'stone',Grass:'grass',Water:'water'})[footstepSurface()],.16,1.15);sample('swish',.12,1.25);break;
      case 'land':sample('stone',.38,.84);break;
      case 'landGrass':sample('grass',.48,.86);break;
      case 'landWater':sample('splash',.55,1.05);break;
      case 'web':sample('swish',.34,1.22);sample('wet',.21,1.35,.025);break;
      case 'release':sample('swish',.16,1.35);break;
      case 'zip':sample('swish',.40,.90);break;
      case 'glide':sample('swish',.24,.85);break;
      case 'bomb':sample('swish',.26,1.10);sample('wet',.17,1.20,.03);break;
      case 'splat':sample('wet',.40,.96);break;
      case 'splash':sample('splash',.55,.95);break;
      case 'slap':sample('swish',.33,1.18);break;
      case 'impact':sample('hit',.48);break;
      case 'metal':sample('metal',.55,.9);sample('hit',.22,.95);break;
      case 'collapse':sample('crash',.60,.88);sample('hit',.30,.72,.025);break;
      case 'electric':sample('spark',.62,.9);sample('hit',.19,1.05);break;
      case 'enemy':sample('swish',.24,1.05);break;
      case 'alert':sample('metal',.16,1.18);break;
      case 'success':sample('chime',.22,1.08);break;
      case 'failure':sample('chime',.14,.72);break;
      case 'horn':sample('horn',.48);break;
      case 'bird':sample('bird',.35);break;
      case 'voiceScream':sample('scream',.24);break;
      case 'voiceGrunt':sample('grunt',.28);break;
      case 'boing':sample('swish',.30,.85);break;
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
  const musicStyles={
    manhattan:{shift:0,lead:'triangle'},
    brooklyn:{shift:-5,lead:'square',chords:[[48,51,55,58],[44,48,51,55],[46,50,53,56],[43,47,50,53]]},
    harlem:{shift:2,lead:'sine',chords:[[48,52,55,59],[45,48,52,55],[50,53,57,60],[43,47,50,53]]}
  };
  // A shared second of white noise for drums and rain.
  let whiteNoiseBuffer=null;
  function whiteNoise() {
    if(!whiteNoiseBuffer && soundContext){whiteNoiseBuffer=soundContext.createBuffer(1,soundContext.sampleRate,soundContext.sampleRate);const data=whiteNoiseBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;}
    return whiteNoiseBuffer;
  }
  function musicStyleFor() {
    const area=currentDistrict||'';
    return /BROOKLYN|DUMBO|CONEY/.test(area)?musicStyles.brooklyn:/HARLEM/.test(area)?musicStyles.harlem:musicStyles.manhattan;
  }
  function musicIntensity(){return stars()>0||Boolean(focusBoss)||Boolean(crime && Math.hypot(crime.x-position.x,crime.z-position.z)<45);}
  function musicDrum(kind,time) {
    if(kind==='kick') {
      const voice=soundContext.createOscillator(),gain=soundContext.createGain();
      voice.frequency.setValueAtTime(130,time);voice.frequency.exponentialRampToValueAtTime(42,time+.13);
      gain.gain.setValueAtTime(.11,time);gain.gain.exponentialRampToValueAtTime(.0001,time+.18);
      voice.connect(gain);gain.connect(musicBus);voice.start(time);voice.stop(time+.2);return;
    }
    const noiseBuffer=whiteNoise();if(!noiseBuffer)return;
    const noise=soundContext.createBufferSource(),filter=soundContext.createBiquadFilter(),gain=soundContext.createGain(),hat=kind==='hat';
    noise.buffer=noiseBuffer;filter.type=hat?'highpass':'bandpass';filter.frequency.value=hat?7000:1800;
    gain.gain.setValueAtTime(hat?.012:.045,time);gain.gain.exponentialRampToValueAtTime(.0001,time+(hat?.04:.13));
    noise.connect(filter);filter.connect(gain);gain.connect(musicBus);noise.start(time);noise.stop(time+.15);
  }
  function scheduleMusic() {
    if(!soundContext || soundContext.state!=='running' || !musicEnabled || document.hidden || nuke)return;
    const now=soundContext.currentTime;
    if(nextMusicNote<now)nextMusicNote=now;
    while(nextMusicNote<now+.15) {
      const step=musicStep%64, bar=Math.floor(step/8), beat=step%8;
      // Each borough gets its own harmony and key; fights add drums.
      const style=musicStyleFor(),chords=style.chords||musicChords;
      const chord=chords[bar%chords.length].map(n=>n+style.shift), raw=musicMelody[step], note=raw===null?null:raw+style.shift;
      if(note!==null)musicTone(note,nextMusicNote,musicBeat*.65,.028,style.lead,2000);
      if(musicIntensity()) {
        if(beat===0||beat===4)musicDrum('kick',nextMusicNote);
        if(beat===2||beat===6)musicDrum('snare',nextMusicNote);
        musicDrum('hat',nextMusicNote);
      }
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
    if(musicBus && soundContext)musicBus.gain.setTargetAtTime(musicEnabled?settings.music:0,soundContext.currentTime,.015);
  });
  function unlockSound() {
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)return;
    try {
      if(!soundContext){
        soundContext=new Audio();musicBus=soundContext.createGain();musicBus.gain.value=musicEnabled?settings.music:0;musicBus.connect(soundContext.destination);
        effectsBus=soundContext.createGain();effectsBus.gain.value=effectsEnabled&&!paused?1:0;
        const limiter=soundContext.createDynamicsCompressor();limiter.threshold.value=-8;limiter.knee.value=8;limiter.ratio.value=8;limiter.attack.value=.004;limiter.release.value=.18;
        effectsBus.connect(limiter);limiter.connect(soundContext.destination);
      }
      loadSoundAssets();
      if(soundContext.state==='suspended')soundContext.resume().then(flushPendingSounds).catch(()=>{});
      else flushPendingSounds();
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
  // The falling phase builds from the same recorded rushing air as traversal.
  function startNukeFallSound() {
    if(nukeFallTone || !soundContext || soundContext.state!=='running')return;
    if(!windBuffer) {
      if(!fallbackSound)return;
      nukeFallTone=new Audio(soundFiles.wind);nukeFallTone.loop=true;nukeFallTone.volume=.03;nukeFallTone.muted=!effectsEnabled || paused;
      nukeFallTone.play().catch(()=>{});return;
    }
    nukeFallTone=soundContext.createBufferSource();nukeFallTone.buffer=windBuffer;nukeFallTone.loop=true;
    nukeFallGain=soundContext.createGain();nukeFallGain.gain.value=.0001;
    nukeFallTone.connect(nukeFallGain);nukeFallGain.connect(effectsBus);nukeFallTone.start();
  }
  function updateNukeFallSound(progress) {
    if(!nukeFallTone)startNukeFallSound();if(!nukeFallTone)return;
    if(nukeFallTone instanceof HTMLMediaElement){nukeFallTone.playbackRate=.75+progress*.65;nukeFallTone.volume=Math.min(1,.03+.18*progress);return;}
    const now=soundContext.currentTime;
    nukeFallTone.playbackRate.setTargetAtTime(.75+progress*.65,now,.12);
    nukeFallGain.gain.setTargetAtTime(.03+.18*progress,now,.12);
  }
  function stopNukeFallSound() {
    if(!nukeFallTone)return;
    if(nukeFallTone instanceof HTMLMediaElement){nukeFallTone.pause();nukeFallTone.currentTime=0;nukeFallTone=null;return;}
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
  window.addEventListener('pointerdown',unlockSound,true);
  window.addEventListener('keydown',unlockSound,true);
  document.addEventListener('visibilitychange',syncEffectsBus);
  function playOof(npc) {playVoice(npc.group.position,'grunt');}
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
    clearCityEvent();cityEventTimer=14;cityEventSequence=0;
    clearRescue();hideRescueNotice();rescueTimer=30;rescueSequence=0;
    while(tethers.length)removeTether(tethers[0]);
    speedBlurAmount=0;speedBlur.style.opacity='0';speedBlur.style.visibility='hidden';
    cancelWebGrab();
    for(const actor of [...cars,...pedestrians,...chargeProps,rhino,...villains])if(actor.webPinned)clearWebPin(actor);
    resetBuildings();
    position.set(0,0,8); velocity.set(0,0,0); distance=0; elapsed=0; rope=null; showWeb(false); onGround=true;
    Object.keys(keys).forEach(k=>keys[k]=false);
    for(const car of cars) {if(car.beacon){car.speed=car.normalSpeed;car.beacon.visible=false;}car.stuck=false;car.webRemaining=0;car.webElapsed=0;car.roll=false;car.currentSpeed=car.speed;car.lateralSpeed=0;car.laneTarget=car.preferredLane;car.laneCooldown=0;car.group.rotation.z=0;car.group.position.y=0;car.waiting=null;car.passenger=null;car.nextPadBounce=0;}
    for(const npc of pedestrians) {
      cancelDonation(npc);npc.donationHistory?.clear();
      if(npc.stationHome){npc.settled=true;npc.rooftopKind=npc.stationHome.kind;npc.group.position.copy(npc.stationHome.position);npc.group.rotation.y=npc.stationHome.yaw;npc.stationHome=null;}
      if(npc.cupCoins){for(const coin of npc.cupCoins)coin.removeFromParent();npc.cupCoins.length=0;}
      npc.dead=false;npc.reviveAt=0;npc.fearTimer=0;npc.panicFrom=null;npc.punchTimer=0;npc.stuck=false;npc.webRemaining=0;npc.webPose=0;npc.top=npc.uprightTop;npc.visit=null;npc.photoTimer=0;npc.nextPadBounce=0;npc.bounceSaved=false;
      npc.leftArm.rotation.x=npc.rightArm.rotation.x=npc.leftLeg.rotation.x=npc.rightLeg.rotation.x=0;
      npc.group.visible=true;npc.group.rotation.x=0;npc.group.rotation.z=0;
      if(npc.settled)seatedRest(npc);if(npc.rooftopKind==='view')rooftopRest(npc);if(npc.wheelchair)restoreWheelchair(npc);
    }
    for(const shot of projectiles) scene.remove(shot.mesh); projectiles.length=0;
    for(const shot of enemyProjectiles)scene.remove(shot.mesh);enemyProjectiles.length=0;
    for(const effect of enemyEffects)scene.remove(effect.mesh);enemyEffects.length=0;
    for(const mark of splatters) disposeWeb(mark); splatters.length=0;
    for(const actor of [...cars,...pedestrians,...chargeProps,rhino,...villains])if(actor.knockback)recoverKnockback(actor);
    for(const prop of chargeProps){releaseActorWeb(prop);prop.webHeld=false;prop.group.position.copy(prop.origin);prop.group.rotation.copy(prop.originRotation);prop.group.visible=true;prop.nextPadBounce=0;if(prop.propType==='pressure-tank'){prop.rearm=0;prop.fuse=0;}}
    for(const pad of bouncePads){pad.compression=0;pad.bed.position.y=.46;pad.ring.position.y=.48;}
    for(const gallery of targetGalleries)resetGallery(gallery);
    rhino.group.position.set(0,0,-29);rhino.group.rotation.set(0,0,0);rhino.body.rotation.set(0,0,0);rhino.state='roam';rhino.timer=0;rhino.webHits=0;rhino.stuck=false;rhino.webRemaining=0;rhino.hitActors.clear();playerImpact=0;
    for(const villain of villains){
      villain.group.position.copy(villain.spawn);villain.group.rotation.set(0,0,0);villain.body.rotation.set(0,0,0);villain.head.rotation.set(0,0,0);
      for(const joint of [...villain.arms,...villain.elbows,...villain.legs,...villain.knees])joint.rotation.set(0,0,0);
      if(villain.glider)villain.glider.rotation.set(0,0,0);
      villain.state='idle';villain.timer=0;villain.webHits=0;villain.stuck=false;villain.webRemaining=0;villain.attacks=0;
    }
    shockTime=0;attackImmunity=0;screenShake=0;hitStop=0;
    wallContact=null;wallRunTime=0;wallCooldown=0;zipTime=0;zipCooldown=0;zipAnchor=null;jumpBuffer=0;coyoteTime=.12;dodgeCooldown=0;padCooldown=0;airTrick=null;slapQueue=0;slapCooldown=0;slapAnimation=0;slapChain=0;slapChainTimer=0;
    recentDanger=null;
    if(reticle)reticle.classList.remove('active','missed','hit');
    for(const boss of bosses){releaseActorWeb(boss.actor);boss.actor.stuck=false;boss.status='dormant';sleepBoss(boss);boss.timer=boss.actor===rhino?30:12;}alertTimer=40;focusBoss=null;updateVillainTracker();
    clearPolice();if(crime)endCrime(false,true);for(const thug of thugs){thug.crime=null;thug.group.visible=false;}crimeTimer=35;playerHp=100;koTimer=0;hurtTimer=0;comboHits=0;comboHitTimer=0;finisherReady=false;dodgeBoost=0;dodgeSlow=0;senseTimer=0;airJumps=0;slowMotion=false;timeScale=1;
    comboPoints=0;comboMultiplier=1;comboTimer=0;updateComboLabel();if(hitsHud)hitsHud.hidden=true;updateHeroHud();shell.classList.remove('ko','low-hp','sense','slowmo');pounding=false;storyStarted=-1;
    yaw=0; pitch=0; handBlend=0; swingPose=0; footPose=0; glideBlend=0;glideEngaged=false;glideWings.visible=false; cameraRoll=0; feedbackTime=0;runPhase=0;runBlend=0;bombAnimation=0;mapTimer=0; anchorMarker.visible=false; camera.fov=72;camera.updateProjectionMatrix();updateViewCamera(0,0,0,true);
  }
  function jump() {
    if(koTimer>0)return;
    // Jumping away from a telegraphed punch is a perfect dodge.
    const dodged=thugs.filter(t=>t.windup>0 && t.group.position.distanceTo(position)<3);
    if(dodged.length){for(const t of dodged){t.windup=0;t.cooldown=1.6;}dodgeSlow=.55;dodgeBoost=3;awardChaos(300,'PERFECT DODGE',null,'trick');}
    if(!onGround && !rope && (zipTime>0 || elapsed-zipEndedAt<.35)) {
      // Jumping as a zip lands turns its momentum into a high launch.
      const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));zipTime=0;zipEndedAt=-9;showWeb(false);
      velocity.y=Math.max(velocity.y,0)+15;velocity.addScaledVector(forward,10);playEffect('zip');awardChaos(150,'POINT LAUNCH',null,'trick');return;
    }
    if (rope) { playEffect('jump'); swing(false); velocity.y=Math.max(velocity.y,7); onGround=false; }
    else if (onGround || coyoteTime>0) { playEffect('jump'); velocity.y=11; onGround=false;coyoteTime=0;jumpBuffer=0; }
    else if(wallContact) {
      playEffect('jump');velocity.x=wallContact.x*12;velocity.z=wallContact.z*12;velocity.y=11;
      wallContact=null;wallCooldown=.35;onGround=false;
    }
    else if(has('doubleJump') && airJumps<1 && !webGrab) {
      airJumps++;velocity.y=Math.max(velocity.y,0)+10;playEffect('jump');burst(position.clone(),12,0xffffff,{speed:4,life:.4,size:.4,gravity:0});
    } else jumpBuffer=.14;
  }
  function dodge() {
    if(paused || koTimer>0 || dodgeCooldown>0 || pounding)return false;
    const direction=movement();if(direction.lengthSq()<.01)direction.set(Math.sin(yaw),0,Math.cos(yaw));else direction.normalize();
    if(rope)swing(false);if(webGrab)cancelWebGrab();
    velocity.x=velocity.x*.25+direction.x*19;velocity.z=velocity.z*.25+direction.z*19;velocity.y=Math.max(velocity.y,onGround?3.2:0);
    onGround=false;coyoteTime=0;dodgeCooldown=.9;attackImmunity=Math.max(attackImmunity,.4);playEffect('zip');
    burst(position.clone().setY(position.y+.2),10,[0xe3d9c5,0xffffff],{speed:3,up:1,life:.35,size:.3,gravity:2});
    if(senseTimer>0) {
      for(const thug of thugs)if(thug.windup>0 && thug.group.position.distanceTo(position)<5){thug.windup=0;thug.cooldown=1.3;}
      dodgeSlow=.45;dodgeBoost=3;awardChaos(300,'PERFECT DODGE',null,'trick');
    }
    return true;
  }
  // Attach only where the pointer intersects a grapple surface.
  function findAnchor(aimX,aimY) {
    raycaster.far=150;
    // Prefer the exact aim, then try a small cone so a near miss still catches a roof.
    for(const [dx,dy] of [[0,0],[0,.055],[-.055,0],[.055,0],[0,-.055]]) {
      raycaster.setFromCamera(new THREE.Vector2(aimX+dx,aimY+dy),camera);
      const hit=raycaster.intersectObjects(grappleMeshes,false)[0];if(hit)return hit;
    }
    return null;
  }
  // A quick web zip pulls toward the surface at the center of the view.
  function webZip() {
    if(zipCooldown>0 || webGrab || nuke?.phase==='blast')return false;
    updateViewCamera(0);scene.updateMatrixWorld(true);
    const hit=findAnchor(0,0);if(!hit){feedbackTime=1;return false;}
    if(rope)swing(false);
    const direction=hit.point.clone().sub(position.clone().add(new THREE.Vector3(0,1.3,0)));
    if(direction.lengthSq()<4)return false;
    playEffect('zip');direction.normalize();velocity.addScaledVector(direction,mutators.rocket?56:28);if(onGround)velocity.y=Math.max(velocity.y,4);
    onGround=false;zipAnchor=hit.point.clone();zipTime=.22;zipCooldown=(has('quickZip')?.28:.55)*((progress.owned||[]).includes('fluid')?.6:1);noteAirMove('zips');showWeb(true);flashReticle();return true;
  }
  function swing(start, aimX=0, aimY=0) {
    if (!start) { if(rope){playEffect('release');if(rope.age>.2){velocity.x*=1.035;velocity.z*=1.035;}}keys.swing=false; rope=null; showWeb(false); anchorMarker.visible=false;if(reticle)reticle.classList.remove('active'); return; }
    if (keys.swing) return;
    if(zipTime>0)showWeb(false);zipTime=0;zipAnchor=null;keys.swing=true;
    updateViewCamera(0);
    scene.updateMatrixWorld(true);
    const hit=findAnchor(aimX,aimY);
    if (!hit) {feedbackTime=1.3;return;}
    const anchor=hit.point.clone(),localAnchor=hit.object.worldToLocal(anchor.clone());
    const hand=position.clone().add(new THREE.Vector3(0,1.3,0));
    playEffect('web');rope={anchor,anchorObject:hit.object,anchorInstance:hit.instanceId,localAnchor,anchorVelocity:new THREE.Vector3(),length:Math.max(2,hand.distanceTo(anchor)),age:0};noteAirMove('swings');showWeb(true);
    anchorMarker.position.copy(anchor);anchorMarker.visible=true;feedbackTime=0;
    if(reticle)reticle.classList.add('active');flashReticle();
    // The web pulls toward the hit point while preserving sideways swing momentum.
    if(onGround) { velocity.y=Math.max(velocity.y,8); velocity.addScaledVector(anchor.clone().sub(hand).normalize(),3); onGround=false; }
  }
  function handWorldPosition() {
    if(cameraMode==='third'&&!cameraNear && hero.rig?.hand){const hand=hero.rig.hand;hand.updateWorldMatrix(true,false);return hand.getWorldPosition(new THREE.Vector3());}
    handsScene.updateMatrixWorld(true);handsCamera.updateMatrixWorld();camera.updateMatrixWorld();
    const fingertip=rightHand.localToWorld(rightHand.userData.fingertip.clone());
    const projected=fingertip.project(handsCamera);
    return new THREE.Vector3(projected.x,projected.y,.5).unproject(camera).sub(camera.position).normalize().multiplyScalar(1.4).add(camera.position);
  }
  function bombTargets() {
    return scene.children.filter(object=>object.visible && ((object.isMesh && object!==sky && !object.userData.projectile) || object.userData?.actor || object.userData?.targetable));
  }
  const actorRayBox=new THREE.Box3(),actorRayPoint=new THREE.Vector3(),actorRayMin=new THREE.Vector3(),actorRayMax=new THREE.Vector3();
  function distantActorHit(ray,limit,exclude=null) {
    let best=null,bestDistance=limit;
    // Distant bodies are detached for rendering, but remain targetable with a cheap box test.
    for(const actor of detailActors) {
      if(actor===exclude || actor.detailShown || actor.dead || !actor.group.visible)continue;
      const p=actor.group.position;actorRayMin.set(p.x-actor.hx-.12,p.y-.1,p.z-actor.hz-.12);actorRayMax.set(p.x+actor.hx+.12,p.y+actor.top+.1,p.z+actor.hz+.12);
      actorRayBox.set(actorRayMin,actorRayMax);const point=ray.intersectBox(actorRayBox,actorRayPoint);if(!point)continue;
      const distance=ray.origin.distanceTo(point);if(distance<bestDistance){bestDistance=distance;best={object:actor.group,point:point.clone(),distance};}
    }
    return best;
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
    if(koTimer>0)return;
    if(webGrab || rope || (nuke?.phase==='blast' && nuke.playerHit))return;
    if(zipTime>0){zipTime=0;zipAnchor=null;showWeb(false);}
    updateViewCamera(0);scene.updateMatrixWorld(true);
    raycaster.far=150;raycaster.setFromCamera(new THREE.Vector2(aimX,aimY),camera);
    let hit=raycaster.intersectObjects(bombTargets(),true)[0];
    hit=distantActorHit(raycaster.ray,hit?.distance??150)||hit;
    let owner=hit?.object;while(owner && !owner.userData.actor)owner=owner.parent;
    const actor=owner?.userData.actor;
    if(actor && !actor.dead && (cars.includes(actor)||pedestrians.includes(actor)||chargeProps.includes(actor)||((actor===rhino||villains.includes(actor)) && actor.state==='subdued' && actor.stuck)) && actor.group.visible) {
      if(actor.webTether)removeTether(actor.webTether);
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
    updateViewCamera(0);scene.updateMatrixWorld(true);
    raycaster.far=150;raycaster.setFromCamera(new THREE.Vector2(aimX,aimY),camera);
    let hit=raycaster.intersectObjects(bombTargets(),true).find(candidate=>{
      let owner=candidate.object;while(owner && !owner.userData.actor)owner=owner.parent;
      return owner?.userData.actor!==actor;
    });
    hit=distantActorHit(raycaster.ray,hit?.distance??150,actor)||hit;
    if(!hit || hit.point.x<worldMinX || hit.point.x>worldMaxX || hit.point.z<worldMinZ || hit.point.z>worldMaxZ || hit.distance>70) {
      // No surface to stick them to: yeet them where you are looking instead.
      const direction=raycaster.ray.direction.clone(),p=actor.group.position;
      if(actor!==rhino && !villains.includes(actor)) {
        throwActor(actor,direction,false,direction.multiplyScalar(cars.includes(actor)?30:42).add(new THREE.Vector3(0,9,0)));
        playEffect('zip',p);playVoice(p,'scream');impactFeedback(1.5);awardChaos(cars.includes(actor)?600:350,cars.includes(actor)?'CAR YEET':'YEET',p.clone().setY(p.y+2));
      } else feedbackTime=1.3;
      return;
    }
    let targetOwner=hit.object;while(targetOwner && !targetOwner.userData.actor)targetOwner=targetOwner.parent;
    const target=targetOwner?.userData.actor;
    if(target?.webTether?.target===actor){feedbackTime=.8;return;}
    if(target && target!==actor && !target.dead && (cars.includes(target)||pedestrians.includes(target)||chargeProps.includes(target)) && target.webTether?.target!==actor) {
      clearWebPin(actor);releaseActorWeb(actor);if(actor.knockback)recoverKnockback(actor);
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([actor.group.position,target.group.position]),new THREE.LineBasicMaterial({color:0xf0ffff}));
      line.frustumCulled=false;line.userData.projectile=true;scene.add(line);
      const tether={actor,target,line,time:0,length:Math.max(2,Math.min(4,actor.group.position.distanceTo(target.group.position)*.5))};
      actor.webTether=tether;tethers.push(tether);playEffect('web');flashReticle();return;
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
  function removeTether(tether) {
    if(!tether)return;
    const index=tethers.indexOf(tether);if(index>=0)tethers.splice(index,1);
    tether.line.removeFromParent();tether.line.geometry.dispose();tether.line.material.dispose();
    const actor=tether.actor;if(actor.webTether===tether)actor.webTether=null;
    actor.group.rotation.x=0;actor.group.rotation.z=0;
    if(pedestrians.includes(actor) && !actor.dead){actor.leftArm.rotation.x=actor.rightArm.rotation.x=0;if(!actor.settled)nearestRouteCorner(actor);actor.pause=.4;}
    if(cars.includes(actor))actor.currentSpeed=0;
    const p=actor.group.position,wet=waterAt(p.x,p.z);let ground=wet?wet.floor:parkElevation(p.x,p.z);
    for(const b of playerColliderCells.get(`${Math.floor(p.x/40)},${Math.floor(p.z/40)}`)||[])if(b.height<=p.y+.1 && b.height>ground && insideBuilding(p.x,p.z,b))ground=b.height;
    if(!actor.dead && !actor.knockback && p.y>ground+.6)actor.knockback={ground,velocity:new THREE.Vector3(0,-2,0),spin:2,time:0};
  }
  function updateTethers(dt) {
    for(let i=tethers.length-1;i>=0;i--) {
      const tether=tethers[i],{actor,target,line}=tether;tether.time+=dt;
      if(nuke || tether.time>12 || actor.dead || target.dead || !actor.group.visible || !target.group.visible){removeTether(tether);continue;}
      const p=actor.group.position,q=target.group.position,delta=q.clone().sub(p),distance=delta.length();
      if(distance>tether.length && distance>.01) {
        const pull=Math.min(distance-tether.length,Math.max(6,Math.min(30,distance*3))*dt);p.addScaledVector(delta,pull/distance);
        if(pedestrians.includes(actor)) {actor.leftArm.rotation.x=1.8+Math.sin(elapsed*8)*.35;actor.rightArm.rotation.x=1.8-Math.sin(elapsed*8)*.35;actor.group.rotation.z=Math.sin(elapsed*7)*.25;}
        else actor.group.rotation.z=Math.sin(elapsed*8)*.2;
      }
      const water=waterAt(p.x,p.z),floor=water?water.floor:inPark(p.x,p.z)?.1+parkElevation(p.x,p.z):0;
      p.y=Math.max(floor,p.y);
      const coords=line.geometry.attributes.position;coords.setXYZ(0,p.x,p.y+actor.top*.55,p.z);coords.setXYZ(1,q.x,q.y+target.top*.55,q.z);coords.needsUpdate=true;
    }
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
    updateViewCamera(0);
    scene.updateMatrixWorld(true);raycaster.far=150;raycaster.setFromCamera(new THREE.Vector2(aimX,aimY),camera);
    let hit=raycaster.intersectObjects(bombTargets(),true)[0];
    hit=distantActorHit(raycaster.ray,hit?.distance??150)||hit;
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
    endNukePanic();
    if(nukeRubble){nukeRubble.removeFromParent();nukeRubble.dispose();nukeRubble=null;}
    blastFlash.style.opacity='0';blastWind.style.opacity='0';blastBlackout.style.opacity='0';blackout=0;blackoutMode='';nukeButton.disabled=false;
  }
  function launchNuke() {
    if(nuke)return;
    if(!nukeUnlocked){showBreaking(`☢ NUKE LOCKED: BEAT ${bosses.length-villainsBeaten.size} MORE VILLAINS OR CAUSE 250,000 CHAOS`);playEffect('failure');return false;}
    // The crosshair targets the nearest visible world surface, including roofs and water.
    updateViewCamera(0);scene.updateMatrixWorld(true);
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
    nuke={group,missile,target,time:0,phase:'warning',radius:0,hitActors:new Set(),hitTrees:new Set(),hitDogs:new Set(),hitAircraft:new Set(),hitDistant:new Set(),distantFlights:[],distantBatches:new Map(),trees:[],flights:[],specials:[],fallingBuildings:[],debris:[],actorOrigins,playerHit:false,playerHitAt:null};nukeButton.disabled=true;playNukeMusic();
  }
  function detonateNuke() {
    playNukeBoom();awardChaos(1000000,'WAR CRIMES',null,'oops');adjustOpinion(-100);addHeat(5);
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
    // Keep the visible wave and all of its collisions on the same expanding front.
    // The playable map is wider than the old 1700-unit cap.
    const radius=nuke.radius=nuke.time*300,wave=nuke.wave;
    wave.scale.setScalar(Math.max(1,radius));wave.material.opacity=Math.max(.16,.7-nuke.time*.16);
    nuke.cloud.scale.setScalar(Math.min(2.4,.4+nuke.time*.35));
    nuke.cloud.position.y=nuke.target.y+Math.min(25,nuke.time*4);
    for(const item of nuke.cloudPuffs) {
      const pulse=1+.08*Math.sin(nuke.time*2+item.angle);
      item.puff.scale.set(item.size*pulse,item.size*pulse,1);
      item.puff.material.opacity=Math.max(0,(item.cap?.55:.65)*Math.min(1,nuke.time*2));
    }
    blastFlash.style.opacity=String(Math.max(0,.8-nuke.time*1.2));
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
    if(!nuke.playerHit && Math.hypot(position.x-nuke.target.x,position.z-nuke.target.z)<=radius) {
      // Use the player's current position, so running or swinging changes arrival time.
      nuke.playerHit=true;nuke.playerHitAt=nuke.time;cancelWebGrab();swing(false);
      const direction=new THREE.Vector3(position.x-nuke.target.x,0,position.z-nuke.target.z);
      if(direction.lengthSq()<.01)direction.set(Math.sin(yaw),0,Math.cos(yaw));
      direction.normalize();velocity.set(direction.x*210,110,direction.z*210);
      position.y=Math.max(position.y,.2);onGround=false;playerImpact=1.4;
    }
    const impactAge=nuke.playerHit?nuke.time-nuke.playerHitAt:-1;
    blastWind.style.opacity=String(impactAge<0?0:Math.max(0,Math.min(.8,impactAge*2,5.8-impactAge)));
    // Give distant players time to be hit and see the launch before the reset.
    const blackoutStart=nuke.playerHit?Math.max(5.5,nuke.playerHitAt+1.5):Infinity;
    if(nuke.time>blackoutStart) {
      blackout=Math.min(1,(nuke.time-blackoutStart)/1.5);blastBlackout.style.opacity=String(blackout);
    }
    if(nuke.time>=blackoutStart+1.7) {
      reset();blackout=1;blackoutMode='out';blastBlackout.style.opacity='1';
    }
  }
  function wrapActor(owner,actor) {
    const wrap=new THREE.Group();owner.add(wrap);
    const isCar=cars.includes(actor)||chargeProps.includes(actor);
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
    if(hit.object.userData.balloon){hitBalloon();return;}
    let targetNode=hit.object;while(targetNode && !targetNode.userData.galleryTarget)targetNode=targetNode.parent;
    if(targetNode?.userData.galleryTarget){hitGalleryTarget(targetNode.userData.galleryTarget);return;}
    const structure=structureForHit(hit);
    if(structure){damageBuilding(structure,1);if(structure.destroyed)return;}
    let owner=hit.object;
    while(owner && !owner.userData.actor) owner=owner.parent;
    let mark;
    if(owner && owner.userData.actor) {
      const actor=owner.userData.actor,wasWebbed=actor.stuck;if(actor.dead)return;
      if(actor.propType==='pressure-tank'){detonateTank(actor);return;}
      mark=wrapActor(owner,actor);mark.userData.webActor=actor;
      if(actor===rhino || villains.includes(actor)) {
        if(actor===rhino)mark.scale.set(2.6,2.2,2.5);else mark.scale.set(1.35,1.4,1.4);
        damageBoss(actor,.5,'WEB SHOT',hit.point);
        if(actor.boss?.status==='active' && actor.state!=='subdued' && actor.state!=='charge' && actor.state!=='windup' && actor.state!=='dive'){actor.state='stagger';actor.timer=.25;}
      }
      else if(pedestrians.includes(actor)) {if(!wasWebbed){awardChaos(80,'GIFT WRAPPED',hit.point);say(actor,'webbed',.6);}actor.stuck=true;cancelVisit(actor);cancelDonation(actor);actor.webRemaining=15;}
      else if(cars.includes(actor)) {
        actor.stuck=true;
        actor.webRemaining=10;
        if(!wasWebbed) {actor.webElapsed=0;actor.roll=actor.currentSpeed>2 && random(actor.seed*7+Math.floor(elapsed*5))>.72;}
      }
      else if(chargeProps.includes(actor)){actor.stuck=true;actor.webRemaining=8;}
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
    if(!cars.includes(actor) && position.y<base+actor.top && position.y+1.8>base) {
      const player={group:{position},hx:.38,hz:.38};
      if(overlaps(p.x,p.z,actor.hx,actor.hz,player) && !overlaps(oldX,oldZ,actor.hx,actor.hz,player)) return true;
    }
    return false;
  }
  let playerNearActors=[],surfCar=null,surfTime=0,carHitCooldown=0,wallRunning=false,zipEndedAt=-9;
  function gatherPlayerNearActors() {
    playerNearActors=[];
    for(const list of [cars,pedestrians])for(const actor of list) {
      const p=actor.group.position;if(Math.abs(p.x-position.x)<30 && Math.abs(p.z-position.z)<30)playerNearActors.push(actor);
    }
  }
  function resolvePlayerActors() {
    for(const actor of playerNearActors) {
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
      if(previous.y>=top && velocity.y<=0) {position.y=top;velocity.y=0;onGround=true;if(cars.includes(actor))surfCar=actor;continue;}
      const fast=person?horizontal>7.5 || (!onGround && velocity.length()>10):cars.includes(actor) && horizontal>28;
      if(fast && !actor.knockback && !actor.webHeld && !actor.webPinned) {
        // Goat rules: anything you run into at speed goes flying.
        const launch=velocity.clone().multiplyScalar(person?1.15:.55);launch.y=Math.max(launch.y,0)+(person?7+horizontal*.18:9);
        throwActor(actor,null,false,launch);velocity.multiplyScalar(person?.85:.6);
        const hitPoint=p.clone().setY(base+1.3);burst(hitPoint,14,[0xfff2a8,0xffffff],{speed:8,up:2,life:.4,size:.3});
        playEffect(person?'impact':'metal',p);impactFeedback(1+horizontal/18);
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
    npc.rightArm.rotation.x=Math.min(1,donation.time*4)*.95;
    if(donation.time>=.25 && !donation.coin) {donation.coin=new THREE.Mesh(coinGeo,goldMat);scene.add(donation.coin);}
    // Far bodies are detached from the scene, so only animate the coin up close.
    if(donation.coin)donation.coin.visible=Boolean(npc.visualRoot?.parent && shelter.visualRoot?.parent);
    if(donation.coin?.visible) {
      npc.group.updateWorldMatrix(true,true);shelter.group.updateWorldMatrix(true,true);
      const from=pedestrianHandPoint(npc);
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
    // Drivers never brake for a masked man in the road.
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
    const panic=nuke && nuke.phase!=='blast'?2.4:1,targetSpeed=obstacle===Infinity?car.speed*panic:Math.min(car.speed*panic,Math.max(0,obstacle*1.5));
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
      // A far owner's body is detached from the scene, so use their group for the hand.
      const from=owner.visualRoot?.parent?pedestrianHandPoint(owner):owner.group.localToWorld(new THREE.Vector3(.23,.85,-.13));
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
    if(actor.thug && actor.crime && !actor.defeated) {
      countHit();
      if(actor.hp>1 && !lethal) {
        // Brutes shrug off the first hits: a stagger instead of a launch.
        actor.hp--;actor.windup=0;actor.cooldown=1.1;const push=launch?launch.clone().setY(0).normalize():new THREE.Vector3(direction?.x||0,0,direction?.z||0);
        actor.group.position.addScaledVector(push,1.2);worldPopup(`STAGGER (${actor.hp} LEFT)`,actor.group.position.clone().setY(actor.group.position.y+2.6),'burst combat',1);
        playEffect('impact',actor.group.position);return;
      }
    }
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
    const p=actor.group.position,oldX=p.x,oldZ=p.z,oldY=p.y;
    if(flight.splat>0) {
      // Cartoon wall splat: stick spread-eagled, then peel off and slide down.
      flight.splat-=dt;if(flight.splat>0){if(pedestrians.includes(actor)){actor.leftArm.rotation.x=actor.rightArm.rotation.x=2.1;actor.leftLeg.rotation.x=.25;actor.rightLeg.rotation.x=-.25;}return true;}
      flight.velocity.set(0,-1,0);flight.spin=.6;
    }
    flight.time+=dt;flight.velocity.y-=(flight.rescue?4:22)*gravityScale*dt;p.addScaledVector(flight.velocity,dt);
    bounceThrownActor(actor,oldY);
    const flightSpeed=Math.hypot(flight.velocity.x,flight.velocity.z);
    if(actor.propType==='pressure-tank' && p.y<=flight.ground+.05 && flight.velocity.y< -5){detonateTank(actor);return true;}
    if(flight.fromPlayer && flightSpeed>9)for(const tank of pressureTanks) {
      if(tank===actor || !tank.group.visible || tank.rearm>0)continue;
      const q=tank.group.position;if(Math.abs(q.x-p.x)<actor.hx+.7 && Math.abs(q.z-p.z)<actor.hz+.7 && Math.abs(q.y-p.y)<2)detonateTank(tank);
    }
    if(flight.fromPlayer && flightSpeed>8)for(const gallery of targetGalleries)for(const target of gallery.targets) {
      if(!target.lit && Math.abs(p.x-target.x)<actor.hx+.8 && Math.abs(p.z-target.z)<actor.hz+.8 && Math.abs(p.y+actor.top*.5-target.y)<actor.top*.5+.8)hitGalleryTarget(target);
    }
    if(flight.bossThrow && !flight.hitPlayer && p.distanceTo(position)<3.4){flight.hitPlayer=true;hitPlayer(flight.velocity.clone(),26,10,false,24);impactFeedback(3);}
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
    if(flight.fromPlayer && flightSpeed>11 && (pedestrians.includes(actor)||cars.includes(actor)||chargeProps.includes(actor))) {
      // Airborne people, carts and cars can all bowl through a crowd.
      for(const other of pedestrians) {
        if(other===actor || other.dead || other.knockback || other.webHeld || other.webPinned || !other.group.visible)continue;
        const q=other.group.position,reachX=Math.min(3,actor.hx+.7),reachZ=Math.min(3,actor.hz+.7);if(Math.abs(q.x-p.x)>reachX || Math.abs(q.z-p.z)>reachZ || p.y-q.y>2.2 || q.y-p.y>1)continue;
        throwActor(other,null,false,flight.velocity.clone().multiplyScalar(.75).add(new THREE.Vector3(0,7,0)));
        if(other.knockback)other.knockback.chain=(flight.chain||0)+1;
        flight.velocity.multiplyScalar(.7);flight.chain=(flight.chain||0)+1;
        playVoice(q,'yelp');burst(q.clone().setY(q.y+1.2),10,[0xfff2a8,0xffffff],{speed:7,life:.35,size:.25});
        awardChaos(flight.chain>=3?600:200,flight.chain>=3?'STRIKE!':'HUMAN BOWLING',q.clone().setY(q.y+2));
      }
    }
    const water=waterAt(p.x,p.z);
    if(water){if(oldY>=water.surface+.2 && p.y<water.surface+.2 && flight.velocity.y<0)playEffect('splash',p);flight.ground=water.floor;if(p.y<water.surface+.2){flight.velocity.x*=Math.exp(-2.5*dt);flight.velocity.z*=Math.exp(-2.5*dt);flight.spin*=Math.exp(-2*dt);}}
    for(const b of buildings) {
      if(b.destroyed)continue;
      if(p.y>b.height || (b.shape?!insideBuilding(p.x,p.z,b,Math.max(actor.hx,actor.hz)):(Math.abs(p.x-b.x)>=b.w/2+actor.hx || Math.abs(p.z-b.z)>=b.d/2+actor.hz)))continue;
      if(b.shape && !insideBuilding(oldX,oldZ,b,Math.max(actor.hx,actor.hz))){p.x=oldX;p.z=oldZ;flight.velocity.x*=-.35;flight.velocity.z*=-.35;continue;}
      const hitX=Math.abs(oldX-b.x)>=b.w/2+actor.hx,hitZ=Math.abs(oldZ-b.z)>=b.d/2+actor.hz;
      if(flight.fromPlayer && !flight.splatted && flightSpeed>13 && (hitX||hitZ) && pedestrians.includes(actor)) {
        flight.splatted=true;flight.splat=1.1;p.x=oldX;p.z=oldZ;
        actor.group.rotation.set(0,hitX?(oldX<b.x?-Math.PI/2:Math.PI/2):(oldZ<b.z?Math.PI:0),0);
        actor.leftArm.rotation.x=actor.rightArm.rotation.x=2.1;actor.leftLeg.rotation.x=.25;actor.rightLeg.rotation.x=-.25;
        playEffect('splat',p);playVoice(p,'grunt');burst(p.clone().setY(p.y+1.2),16,[0xffffff,0xd8d0c4],{speed:5,life:.5,size:.4});
        awardChaos(350,'WALL SPLAT',p.clone().setY(p.y+2.4));say(actor,'hit',.7);continue;
      }
      if(hitX){p.x=oldX;flight.velocity.x*=-.35;}
      if(hitZ){p.z=oldZ;flight.velocity.z*=-.35;}
    }
    p.x=THREE.MathUtils.clamp(p.x,worldMinX,worldMaxX);p.z=THREE.MathUtils.clamp(p.z,worldMinZ,worldMaxZ);
    actor.group.rotation.x+=flight.spin*dt;actor.group.rotation.z+=flight.spin*.6*dt;
    if(pedestrians.includes(actor) && !flight.splat) {
      actor.leftArm.rotation.x=Math.sin(flight.time*10)*1.3;actor.rightArm.rotation.x=-actor.leftArm.rotation.x;
      actor.leftLeg.rotation.x=Math.sin(flight.time*9)*.9;actor.rightLeg.rotation.x=-actor.leftLeg.rotation.x;
    }
    if(p.y<=flight.ground && flight.velocity.y<0) {
      if(flight.velocity.y<-9 && (flight.bounces||0)<2 && !flight.lethal) {
        // Bounce a couple of times before settling.
        p.y=flight.ground+.02;flight.velocity.y*=-.38;flight.velocity.x*=.6;flight.velocity.z*=.6;flight.bounces=(flight.bounces||0)+1;flight.spin*=.6;
        playEffect(water?'landWater':cars.includes(actor)?'metal':'land',p);burst(p.clone().setY(p.y+.2),8,0xcfc7b8,{speed:3,up:1.5,life:.6,gravity:2,size:.6});
        if(pedestrians.includes(actor))playVoice(p,'grunt');return true;
      }
      if(pedestrians.includes(actor)) {
        p.y=flight.ground;
        if(flight.fromPlayer && flight.time>1.2)awardChaos(Math.round(flight.time*120),`AIRTIME ${flight.time.toFixed(1)}s`,p.clone().setY(p.y+1.5));
        if(water)burst(p.clone().setY(water.surface+.1),24,[0xd8f4ff,0x8fd1e8],{speed:6,up:7,life:.9,size:.35});
        if(flight.lethal){civilianCasualty(actor);return true;}
        if(actor.thug && actor.crime){defeatThug(actor,actor.thug==='brute'?'BRUTE DOWN':'THUG DOWN');}
        else if(actor.cop && actor.active){defeatCop(actor,flight.fromPlayer);}
        else if(flight.fromPlayer)say(actor,'land',.5);
        flight.phase='down';flight.remaining=(actor.thug&&actor.crime)||(actor.cop&&actor.active)?1e9:6;
        actor.group.rotation.set(Math.PI/2,actor.group.rotation.y,0);actor.top=.65;
        actor.leftArm.rotation.x=.35;actor.rightArm.rotation.x=-.35;
        actor.leftLeg.rotation.x=.2;actor.rightLeg.rotation.x=-.2;
      } else recoverKnockback(actor);
    }
    return true;
  }
  function clearRescue() {
    if(!rescue)return;
    rescue.actor.bounceSaved=false;
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
      actor.bounceSaved=false;
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
      success=Boolean(actor.bounceSaved || (actor.webPinned && actor.webPinned.elapsed>=actor.webPinned.duration));
      failed=actor.dead;
      if(!success&&!failed&&!actor.webHeld&&!actor.webPinned&&!actor.knockback) {
        actor.knockback={ground:inPark(actor.group.position.x,actor.group.position.z)?.1:.45,velocity:new THREE.Vector3(0,-2,0),spin:1.4,time:0,lethal:true,rescue:true};
      }
    } else {
      success=Boolean((actor.webPinned && actor.webPinned.elapsed>=actor.webPinned.duration) || (actor.stuck && !actor.webPinned && actor.currentSpeed<1));
      failed=event.time>20 || event.hits.size>=2;
    }
    if(success||failed){const where=actor.group.position.clone().setY(actor.group.position.y+2.5);if(success){gainBucks(40);awardChaos(event.type==='fall'?800:600,'HERO MOMENT',where,'hero');burst(where,40,confetti,{speed:9,up:6,life:1.4,size:.3});if(event.type==='fall')say(actor,'saved');}else awardChaos(400,event.type==='fall'?'MORAL FLEXIBILITY':'NOT MY PROBLEM',where,'oops');playEffect(success?'success':'failure');event.result=success?'success':'failed';event.time=0;event.marker.material.color.setHex(success?0x75ed9d:0xd65b50);}
  }
  // Short ambient incidents use existing actors and physics, so the player can intervene.
  let cityEvent=null,cityEventTimer=14,cityEventSequence=0;
  function clearCityEvent() {
    if(!cityEvent)return;
    if(cityEvent.type==='performance' && cityEvent.actor && !cityEvent.actor.knockback) {
      cityEvent.actor.settled=cityEvent.wasSettled;cityEvent.actor.rooftopKind=cityEvent.wasKind;
    }
    cityEvent=null;
  }
  function startCityEvent(type) {
    if(cityEvent || nuke)return false;
    if(type==='cart') {
      const candidates=chargeProps.filter(a=>a.propType==='food-cart' && a.group.visible && !a.knockback && !a.stuck && !a.webHeld && !a.webPinned && !a.webTether && a.group.position.distanceToSquared(position)<100*100);
      if(!candidates.length)return false;
      const actor=candidates.reduce((a,b)=>a.group.position.distanceToSquared(position)<b.group.position.distanceToSquared(position)?a:b);
      cityEvent={type,actor,time:0,hits:new Set(),direction:random(actor.seed+elapsed)>.5?1:-1};
      showRescueNotice('cart');playEffect('alert',actor.group.position);return true;
    }
    if(type==='rescue') {
      if(rescue || !startRescue('fall'))return false;
      cityEvent={type,actor:rescue.actor,time:0};return true;
    }
    if(type==='performance') {
      const actor=pedestrians.find(a=>a.role==='performer' && !a.rooftop && !a.dead && !a.knockback && !a.webHeld && !a.stuck && a.group.visible && a.group.position.distanceToSquared(position)<75*75);
      if(!actor)return false;
      cityEvent={type,actor,time:0,wasSettled:actor.settled,wasKind:actor.rooftopKind};actor.settled=true;actor.rooftopKind='party';
      for(const other of pedestrians)if(other!==actor && !other.settled && !other.knockback && other.group.visible && other.group.position.distanceToSquared(actor.group.position)<8*8)other.pause=2+random(other.seed)*3;
      return true;
    }
    if(type==='pileup') {
      const nearby=cars.filter(a=>a.group.visible && !a.knockback && !a.stuck && !a.webHeld && !a.webPinned && !a.webTether && a.group.position.distanceToSquared(position)<85*85).slice(0,2);
      if(nearby.length<2)return false;
      cityEvent={type,actor:nearby[0],cars:nearby,time:0};
      for(let i=0;i<nearby.length;i++) {
        const car=nearby[i],direction=new THREE.Vector3((i?1:-1)*.45,0,-1).normalize();
        throwActor(car,direction,false,direction.clone().multiplyScalar(8+i*2).add(new THREE.Vector3(0,5,0)));
        if(car.knockback)car.knockback.cityEvent=true;
      }
      recentDanger={position:nearby[0].group.position.clone(),time:4};playEffect('impact',nearby[0].group.position);return true;
    }
    return false;
  }
  function updateCityCart(event,grid,dt) {
    if(!event || event.type!=='cart')return;
    const actor=event.actor,p=actor.group.position;if(actor.knockback || actor.webHeld || actor.webPinned || actor.stuck || actor.webTether)return;
    const oldX=p.x,oldZ=p.z;p.z+=event.direction*8*dt;actor.group.rotation.z=Math.sin(event.time*12)*.08;
    if(waterAt(p.x,p.z) || (buildingCells.get(`${Math.floor(p.x/40)},${Math.floor(p.z/40)}`)||[]).some(b=>insideBuilding(p.x,p.z,b,.5))) {p.x=oldX;p.z=oldZ;event.direction*=-1;}
    for(const other of nearbyActors(grid,actor)) {
      if(!pedestrians.includes(other) || event.hits.has(other) || other.dead || other.knockback || !other.group.visible)continue;
      const q=other.group.position;if(Math.abs(q.x-p.x)>1.2 || Math.abs(q.z-p.z)>1.2 || Math.abs(q.y-p.y)>2)continue;
      event.hits.add(other);const launch=new THREE.Vector3((q.x-p.x)*3,8,event.direction*13);throwActor(other,launch.clone().normalize(),false,launch);
      playVoice(q,'yelp');burst(q.clone().setY(q.y+1),10,[0xffd777,0xffffff],{speed:5,life:.4,size:.25});
    }
  }
  function updateCityEvent(dt) {
    if(nuke){clearCityEvent();return;}
    if(!cityEvent) {
      cityEventTimer-=dt;if(cityEventTimer>0)return;
      const types=['cart','rescue','performance','pileup'];let started=false;
      for(let i=0;i<types.length && !started;i++)started=startCityEvent(types[(cityEventSequence+i)%types.length]);
      cityEventSequence=(cityEventSequence+1)%types.length;cityEventTimer=started?25:8;return;
    }
    const event=cityEvent;event.time+=dt;let done=false,success=false;
    if(event.type==='cart') {
      success=Boolean(event.actor.webHeld || event.actor.webPinned || event.actor.stuck || event.actor.webTether);
      done=success || Boolean(event.actor.knockback) || event.hits.size>=3 || event.time>14;
      if(done){event.actor.group.rotation.z=0;awardChaos(success?650:250,success?'CART STOPPED':'CART ESCAPED',null,success?'hero':'oops');playEffect(success?'success':'failure');}
    } else if(event.type==='rescue')done=!rescue || rescue.result!=='active';
    else if(event.type==='performance')done=event.actor.dead || Boolean(event.actor.knockback) || event.actor.stuck || event.time>14;
    else if(event.type==='pileup')done=event.time>8;
    if(done){clearCityEvent();cityEventTimer=22+random(elapsed)*10;}
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
        playEffect('alert',rhino.group.position);rhino.state='windup';rhino.timer=.9;
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
      if(obstruction) {
        // Charging headfirst into a building leaves Rhino dazed and open.
        if(obstruction.parts)damageBuilding(obstruction,5);
        p.copy(old);rhino.state='subdued';rhino.stuck=true;rhino.webRemaining=3.2;rhino.timer=0;obstruction=null;
        impactFeedback(3);playEffect('collapse',p);worldPopup('RHINO IS DAZED! GO!',p.clone().setY(5),'burst trick',1.6);
      }
      const blocked=p.x<worldMinX||p.x>worldMaxX||p.z<worldMinZ||p.z>worldMaxZ||Boolean(waterAt(p.x,p.z))||Boolean(obstruction);
      if(blocked && rhino.state==='charge'){p.copy(old);rhino.state='recover';rhino.timer=1.4;}
      const stride=Math.sin(elapsed*17);
      rhino.body.rotation.x=-.38;rhino.arms[0].rotation.x=stride*.5+.5;rhino.arms[1].rotation.x=-stride*.5+.5;
      rhino.legs[0].rotation.x=-stride*.6;rhino.legs[1].rotation.x=stride*.6;
      // Check the full segment travelled this frame, so fast charges cannot skip targets.
      const segment=p.clone().sub(old),lengthSq=segment.lengthSq();
      const near=(point,radius)=>{const t=lengthSq?THREE.MathUtils.clamp(point.clone().sub(old).dot(segment)/lengthSq,0,1):0;return Math.hypot(point.x-old.x-segment.x*t,point.z-old.z-segment.z*t)<radius;};
      if(!rhino.hitActors.has('player') && position.y<4 && near(position,1.8)) {
        rhino.hitActors.add('player');damagePlayer(rhino.enraged?34:26);cancelWebGrab();swing(false);velocity.set(rhino.direction.x*38,18,rhino.direction.z*38);position.y=Math.max(.1,position.y);onGround=false;playerImpact=1.2;
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
  function hitPlayer(direction,power,lift,electric=false,damage=null) {
    if(attackImmunity>0 || koTimer>0)return;
    damagePlayer(damage??Math.round(power*.7));
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
    if(playerCenter.distanceTo(point)<radius+1)hitPlayer(playerCenter.clone().sub(point),electric?12:24,electric?7:13,electric,electric?15:20);
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
  function fireEnemyShot(villain,spread=0) {
    const electric=villain.kind==='electro',origin=villain.group.position.clone().add(new THREE.Vector3(0,electric?1.5:.3,0));
    playEffect(electric?'electric':'enemy',origin);
    const target=position.clone().add(new THREE.Vector3(0,1,0)),direction=target.sub(origin).normalize().applyAxisAngle(new THREE.Vector3(0,1,0),spread);
    const mesh=new THREE.Mesh(villainShotGeometry,electric?electroShotMaterial:goblinBombMaterial);
    const size=electric?.24:.38;mesh.scale.setScalar(size);mesh.position.copy(origin);mesh.userData.projectile=true;scene.add(mesh);
    const velocity=direction.multiplyScalar(electric?32:27);if(!electric)velocity.y+=3;
    enemyProjectiles.push({mesh,velocity,electric,life:3});
  }
  function updateEnemyProjectiles(dt,actors) {
    for(let i=enemyProjectiles.length-1;i>=0;i--) {
      const shot=enemyProjectiles[i],old=shot.mesh.position.clone();shot.life-=dt;
      if(!shot.electric && !shot.bullet)shot.velocity.y-=9*dt;
      shot.mesh.position.addScaledVector(shot.velocity,dt);
      const p=shot.mesh.position,delta=p.clone().sub(old),lengthSq=delta.lengthSq();
      const playerCenter=position.clone().add(new THREE.Vector3(0,1,0));
      const t=lengthSq?THREE.MathUtils.clamp(playerCenter.clone().sub(old).dot(delta)/lengthSq,0,1):0;
      const hitPlayerDirect=playerCenter.distanceToSquared(old.clone().addScaledVector(delta,t))<1.4*1.4;
      const hitBuilding=buildings.some(b=>p.y>=0&&p.y<b.height&&insideBuilding(p.x,p.z,b,0));
      if(hitPlayerDirect||p.y<=0||hitBuilding||shot.life<=0) {
        if(shot.taser){if(hitPlayerDirect)hitPlayer(delta.clone(),4,2,true,7);burst(p,8,[0xb8f8ff,0xffffff],{speed:4,life:.2,size:.2});}
        else if(shot.bullet){if(hitPlayerDirect)hitPlayer(delta.clone(),5,2,false,8);burst(p,6,[0xffe08a,0xffffff],{speed:4,life:.2,size:.2});}
        else if(shot.life>0)enemyBlast(p,shot.electric?1.8:5,actors,shot.electric);
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
          if(p.distanceTo(desired)<3)hitPlayer(position.clone().sub(p),30,14,false,26);
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
          villain.elbows[i].rotation.x=windup ? .7 : .45;
          villain.legs[i].rotation.set(.7,0,side*.18);villain.knees[i].rotation.x=-1.0;
        } else {
          villain.arms[i].rotation.set(windup?(villain.kind==='electro'?1.35:.8):side*stride*.7,0,side*(villain.kind==='octopus'?.18:.08));
          villain.elbows[i].rotation.x=windup ? .65 : .12;
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
          const center=p.clone().add(new THREE.Vector3(0,1,0));enemyFlash(center,9);
          if(distance<10 && Math.abs(position.y-p.y)<5)hitPlayer(new THREE.Vector3(dx,0,dz),30,12,false,24);
          for(const actor of actors)if(actor.group.visible&&!actor.rooftop&&Math.hypot(actor.group.position.x-p.x,actor.group.position.z-p.z)<9) {
            const direction=actor.group.position.clone().sub(p);direction.y=0;if(direction.lengthSq()<.01)direction.set(0,0,1);throwActor(actor,direction.normalize());
          }
        } else if(villain.kind==='goblin' && (++villain.attacks%2===0)) {villain.state='dive';villain.timer=2.5;}
        else {fireEnemyShot(villain);if(villain.enraged){fireEnemyShot(villain,.18);fireEnemyShot(villain,-.18);}}
        if(villain.state!=='dive'){villain.state='cooldown';villain.timer=villain.kind==='goblin'?2.2:1.8;}
      } else if((villain.state==='stagger'||villain.state==='cooldown')&&villain.timer===0)villain.state='idle';
      if(villain.state==='idle') {
        const vertical=Math.abs(position.y-p.y),range=villain.kind==='octopus'?8:villain.kind==='electro'?55:75;
        if(distance<range && vertical<(villain.kind==='octopus'?5:55)){villain.state='windup';villain.timer=villain.kind==='octopus'?.8:1;}
      }
      villain.body.rotation.x=(villain.kind==='goblin'?.28:0)+(villain.state==='windup'?.2:0);
    }
  }
