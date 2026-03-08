addEventListener('DOMContentLoaded',()=>{const pForm=document.getElementById('profile-form'),wForm=document.getElementById('weight-log-form'),mTarget=document.getElementById('monthly-target'),wHist=document.getElementById('weight-history'),rOut=document.getElementById('routine-output'),startBtn=document.getElementById('start-workout'),hud=document.getElementById('workout-hud'),timerEl=document.getElementById('timer-display'),speedEl=document.getElementById('speed-prompt'),phaseEl=document.getElementById('phase'),pauseBtn=document.getElementById('pause-workout'),stopBtn=document.getElementById('stop-workout'),dailyGrid=document.getElementById('daily-log'),bpmFilter=document.getElementById('bpm-filter'),plSelect=document.getElementById('playlist-select'),connectSp=document.getElementById('connect-spotify'),playBtn=document.getElementById('play-playlist'),ppBtn=document.getElementById('play-pause'),nextBtn=document.getElementById('next-track'),ytUrl=document.getElementById('youtube-url'),loadYt=document.getElementById('load-youtube'),ppYt=document.getElementById('play-pause-youtube'),nextYt=document.getElementById('next-youtube')

let profile=JSON.parse(localStorage.getItem('p'))||{},logs=JSON.parse(localStorage.getItem('logs'))||[],daily=JSON.parse(localStorage.getItem('daily'))||{},tInterval,sTime=0,phTime=0,phase='warmup',baseSp,maxSp,aCtx=null,isPaused=false,spPlayer=null,spToken=null,ytPlayer=null,autoSp=localStorage.getItem('autoSp')!=='false',autoYt=localStorage.getItem('autoYt')!=='false'

document.getElementById('autoplay-spotify').checked=autoSp
document.getElementById('autoplay-youtube').checked=autoYt

document.getElementById('autoplay-spotify').onchange=e=>{autoSp=e.target.checked;localStorage.setItem('autoSp',autoSp)}
document.getElementById('autoplay-youtube').onchange=e=>{autoYt=e.target.checked;localStorage.setItem('autoYt',autoYt)}

function beep(f=800,d=150,v=0.3,t='sine'){if(!aCtx)aCtx=new(window.AudioContext||window.webkitAudioContext);const o=aCtx.createOscillator(),g=aCtx.createGain();o.connect(g);g.connect(aCtx.destination);o.type=t;o.frequency.value=f;g.gain.value=v;const n=aCtx.currentTime;o.start(n);o.stop(n+d/1000)}

// Load profile
if(Object.keys(profile).length){Object.assign(document,{sex:profile.sex,age:profile.age,height:profile.height,'current-weight':profile.currentWeight,'target-weight':profile.targetWeight,'fitness-level':profile.fitnessLevel});calcTarget();genRoutine();showLogs();showDaily();suggestBpm()}

pForm.onsubmit=e=>{e.preventDefault();profile={sex:sex.value,age:+age.value,height:+height.value,currentWeight:+document.getElementById('current-weight').value,targetWeight:+document.getElementById('target-weight').value,fitnessLevel:document.getElementById('fitness-level').value};localStorage.setItem('p',JSON.stringify(profile));calcTarget();genRoutine();logW(profile.currentWeight);showDaily();suggestBpm()}

wForm.onsubmit=e=>{e.preventDefault();logW(+document.getElementById('log-weight').value);document.getElementById('log-weight').value=''}

function logW(w){const d=new Date().toLocaleDateString(),h=profile.height/100,bmi=(w/(h*h)).toFixed(2);logs.push({d,w,bmi});localStorage.setItem('logs',JSON.stringify(logs));showLogs()}

function showLogs(){if(!logs.length)return;let h='<table><tr><th>Date</th><th>kg</th><th>BMI</th><th>Δkg</th><th>ΔBMI</th></tr>';for(let i=0;i<logs.length;i++){const l=logs[i],p=i?logs[i-1]:null;h+=`<tr><td>${l.d}</td><td>${l.w}</td><td>${l.bmi}</td><td>${p? (l.w-p.w>0?`<span class="up">↑ +${(l.w-p.w).toFixed(2)}</span>`:`<span class="down">↓ ${(l.w-p.w).toFixed(2)}</span>`):''}</td><td>${p? (l.bmi-p.bmi>0?`<span class="up">↑ +${(l.bmi-p.bmi).toFixed(2)}</span>`:`<span class="down">↓ ${(l.bmi-p.bmi).toFixed(2)}</span>`):''}</td></tr>`}h+='</table>';wHist.innerHTML=h;new Chart(document.getElementById('bmi-chart').getContext('2d'),{type:'line',data:{labels:logs.map(l=>l.d),datasets:[{label:'BMI',data:logs.map(l=>l.bmi),borderColor:'#0ea5e9',backgroundColor:'rgba(14,165,233,0.2)'}]},options:{scales:{y:{beginAtZero:false}}}})}}

function calcTarget(){const need=profile.currentWeight-profile.targetWeight;if(need<=0){mTarget.innerHTML='<p>No loss needed.</p>';return}const m=(0.75*4).toFixed(1),st=Math.ceil(need/5);let h=`<p>Monthly: ${m} kg</p><ul>`;for(let i=1;i<=st;i++)h+=`<li>Stage ${i}: ${(profile.currentWeight-i*5).toFixed(1)} kg</li>`;h+='</ul>';mTarget.innerHTML=h}

function genRoutine(){const{s:sex,a:age,h:height,l:level}=profile,hm=height/100,k=sex==='male'?0.415:sex==='female'?0.413:0.414,sl=hm*k,ts=age<60?(sex==='male'?9000:sex==='female'?8000:8500):(sex==='male'?7000:sex==='female'?6000:6500),sp=level==='low'?0.4:level==='medium'?0.6:0.8,inc=level==='low'?0.1:level==='medium'?0.05:0.025;baseSp=level==='low'?3:level==='medium'?4:5;maxSp=baseSp+(level==='low'?2:level==='medium'?3:4);let h=`<p>Target steps: ${ts}</p><p>Stride: ${(sl*100).toFixed(1)} cm</p><table><tr><th>Weeks</th><th>Steps</th><th>Min</th></tr>`;let cp=sp;for(let i=1;i<=12;i+=2){const s=Math.round(ts*cp),d=(s*sl)/1000,t=Math.round(d/baseSp*60);h+=`<tr><td>${i}-${Math.min(i+1,12)}</td><td>${s}</td><td>${t}</td></tr>`;cp=Math.min(1,cp+inc*2)}h+='</table>';rOut.innerHTML=h}

function showDaily(){let h='';for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const ds=d.toISOString().split('T')[0],ch=daily[ds]?'checked':'';h+=`<div class="daily-checkbox"><input type="checkbox" id="d${ds}" ${ch} onchange="toggleD('${ds}')"><label for="d${ds}">${d.toLocaleDateString('en-US',{weekday:'short',day:'numeric'})}</label></div>`}dailyGrid.innerHTML=h}window.toggleD=ds=>{daily[ds]=document.getElementById(`d${ds}`).checked;localStorage.setItem('daily',JSON.stringify(daily))}

startBtn.onclick=()=>{if(aCtx)aCtx.resume();hud.style.display='block';startBtn.style.display='none';sTime=phTime=0;phase='warmup';isPaused=false;pauseBtn.textContent='Pause';updateH();tInterval=setInterval(()=>{if(!isPaused){sTime++;phTime++;updateH()}},1000);if(autoSp&&spPlayer&&spToken){const u=plSelect.value;u&&startSp(u)}if(autoYt&&ytPlayer)ytPlayer.playVideo()}

pauseBtn.onclick=()=>{if(isPaused){tInterval=setInterval(()=>{sTime++;phTime++;updateH()},1000);pauseBtn.textContent='Pause';if(spPlayer)spPlayer.togglePlay();if(ytPlayer)ytPlayer.playVideo();isPaused=false}else{clearInterval(tInterval);pauseBtn.textContent='Resume';if(spPlayer)spPlayer.pause();if(ytPlayer)ytPlayer.pauseVideo();isPaused=true}}

stopBtn.onclick=()=>{clearInterval(tInterval);hud.style.display='none';startBtn.style.display='block';const t=new Date().toISOString().split('T')[0];daily[t]=true;localStorage.setItem('daily',JSON.stringify(daily));showDaily();beep(440,300,0.4,'sine');alert('Done!')}

function updateH(){const m=Math.floor(sTime/60).toString().padStart(2,'0'),s=(sTime%60).toString().padStart(2,'0');timerEl.textContent=`${m}:${s}`;let spd,cue=false,f=800;if(phase==='warmup'){phaseEl.textContent='Warm-up';spd=baseSp+(phTime/300)*(maxSp-baseSp);if(phTime>=300){phase='main';phTime=0;cue=true;f=1000}else if(Math.floor(phTime/60)!==Math.floor((phTime-1)/60)){cue=true;f=700}}else if(phase==='main'){phaseEl.textContent='Main';const iv=Math.floor(phTime/60)%2;spd=iv===0?maxSp:baseSp+1;if(Math.floor(phTime/60)!==Math.floor((phTime-1)/60)){cue=true;f=iv===0?950:650}if(sTime>=1200){phase='cooldown';phTime=0;cue=true;f=400}}else if(phase==='cooldown'){phaseEl.textContent='Cool-down';spd=maxSp-(phTime/300)*(maxSp-baseSp);if(phTime>=300)return stopBtn.click()}speedEl.textContent=`Speed: ${spd.toFixed(1)} km/h`;if(cue){beep(f,180,0.35,'sine');speedEl.classList.add('flash');setTimeout(()=>speedEl.classList.remove('flash'),400)}}

// Spotify (condensed)
window.onSpotifyWebPlaybackSDKReady=()=>{console.log('Spotify ready')}
connectSp.onclick=async()=>{spToken=prompt("Spotify token:");if(!spToken)return;spPlayer=new Spotify.Player({name:'FitTrack',getOAuthToken:cb=>cb(spToken),volume:0.5});spPlayer.addListener('ready',({device_id})=>{document.getElementById('player-status').textContent='Connected';playBtn.disabled=ppBtn.disabled=nextBtn.disabled=false});await spPlayer.connect()}
ppBtn.onclick=()=>spPlayer?.togglePlay()
nextBtn.onclick=()=>spPlayer?.nextTrack()
playBtn.onclick=()=>{const u=plSelect.value;if(u&&spPlayer&&spToken)fetch('https://api.spotify.com/v1/me/player/play',{method:'PUT',headers:{Authorization:`Bearer ${spToken}`,'Content-Type':'application/json'},body:JSON.stringify({context_uri:u})}).catch(()=>alert('Playback error'))}

// YouTube (condensed)
function onYouTubeIframeAPIReady(){}
loadYt.onclick=()=>{const u=ytUrl.value.trim();if(!u)return alert('Enter URL');let v='',l='';try{const p=new URLSearchParams(new URL(u).search);v=p.get('v')||u.split('youtu.be/')[1]?.split('?')[0]||'';l=p.get('list')||''}catch(e){return alert('Invalid URL')}if(!v&&!l)return alert('No ID found');if(ytPlayer)ytPlayer.destroy();ytPlayer=new YT.Player('youtube-player',{height:0,width:0,videoId:v,playerVars:{listType:l?'playlist':undefined,list:l||undefined,controls:0,modestbranding:1,rel:0,showinfo:0,fs:0},events:{onReady:e=>{ppYt.disabled=nextYt.disabled=false;e.target.playVideo()}}})}

ppYt.onclick=()=>{if(ytPlayer){ytPlayer.getPlayerState()===YT.PlayerState.PLAYING?ytPlayer.pauseVideo():ytPlayer.playVideo()}}
nextYt.onclick=()=>ytPlayer?.nextVideo?.()

// BPM filter & suggest (very short)
const pl=[{u:"spotify:playlist:0VSg3Ize1XJArEzV6fCVW5",l:"Running 120-160",b:"120-160"},{u:"spotify:playlist:25cZd1BFqm8QOrkCRkLnOu",l:"Treadmill Gym",b:"140-160"},{u:"spotify:playlist:4cIIkfHB5ukTjRcn0zNGRk",l:"Gym Pop",b:"140-160"},{u:"spotify:playlist:6MIOcZ4tBKvEiQHzclhVAQ",l:"Running 2026",b:"140-160"},{u:"spotify:playlist:46fOOGy5b5J4buNttN14VN",l:"Running Beats",b:"160+"},{u:"spotify:playlist:6J9d0FIOVPONRIFDQ6lof2",l:"Cardio Hits",b:"160+"}]

function upPl(f='all'){plSelect.innerHTML='<option value="">Select...</option>';(f==='all'?pl:pl.filter(p=>p.b.includes(f)||p.b===f)).forEach(p=>{const o=document.createElement('option');o.value=p.u;o.textContent=p.l;plSelect.appendChild(o)})}function sug(){if(!profile?.fitnessLevel)return;bpmFilter.value=profile.fitnessLevel==='low'?'120-140':profile.fitnessLevel==='medium'?'140-160':'160+';upPl(bpmFilter.value)}bpmFilter.onchange=e=>upPl(e.target.value);upPl();function suggest(){if(profile?.fitnessLevel)sug()}

// Call suggest after profile load & save
// (add suggest() after showDaily() in both load and submit blocks)

startWorkoutBtn.onclick=startWorkout
pauseBtn.onclick=togglePause
stopBtn.onclick=stopWorkout
})
