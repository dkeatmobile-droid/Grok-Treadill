addEventListener('DOMContentLoaded', () => {
  const pForm = document.getElementById('profile-form')
  const wForm = document.getElementById('weight-log-form')
  const mTarget = document.getElementById('monthly-target')
  const wHist = document.getElementById('weight-history')
  const rOut = document.getElementById('routine-output')
  const startBtn = document.getElementById('start-workout')
  const hud = document.getElementById('workout-hud')
  const timerEl = document.getElementById('timer-display')
  const speedEl = document.getElementById('speed-prompt')
  const phaseEl = document.getElementById('phase')
  const pauseBtn = document.getElementById('pause-workout')
  const stopBtn = document.getElementById('stop-workout')
  const dailyGrid = document.getElementById('daily-log')

  let profile = JSON.parse(localStorage.getItem('p')) || {}
  let logs = JSON.parse(localStorage.getItem('logs')) || []
  let daily = JSON.parse(localStorage.getItem('daily')) || {}
  let tInterval, sTime = 0, phTime = 0, phase = 'warmup'
  let baseSp, maxSp, aCtx = null, isPaused = false

  function beep(f=800,d=150,v=0.3,t='sine') {
    if (!aCtx) aCtx = new (window.AudioContext || window.webkitAudioContext)
    const o = aCtx.createOscillator(), g = aCtx.createGain()
    o.connect(g); g.connect(aCtx.destination)
    o.type = t; o.frequency.value = f; g.gain.value = v
    const n = aCtx.currentTime
    o.start(n); o.stop(n + d/1000)
  }

  // Load profile
  if (Object.keys(profile).length) {
    ['sex','age','height','current-weight','target-weight','fitness-level']
      .forEach(id => document.getElementById(id).value = profile[id.replace(/-/g,'')||id])
    calcTarget(); genRoutine(); showLogs(); showDaily()
  }

  pForm.onsubmit = e => {
    e.preventDefault()
    profile = {
      sex: sex.value,
      age: +age.value,
      height: +height.value,
      currentWeight: +document.getElementById('current-weight').value,
      targetWeight: +document.getElementById('target-weight').value,
      fitnessLevel: document.getElementById('fitness-level').value
    }
    localStorage.setItem('p', JSON.stringify(profile))
    calcTarget(); genRoutine(); logW(profile.currentWeight); showDaily()
  }

  wForm.onsubmit = e => {
    e.preventDefault()
    logW(+document.getElementById('log-weight').value)
    document.getElementById('log-weight').value = ''
  }

  function logW(w) {
    const d = new Date().toLocaleDateString()
    const h = profile.height / 100
    const bmi = (w / (h * h)).toFixed(2)
    logs.push({d, w, bmi})
    localStorage.setItem('logs', JSON.stringify(logs))
    showLogs()
  }

  function showLogs() {
    if (!logs.length) return
    let h = '<table><tr><th>Date</th><th>kg</th><th>BMI</th><th>Δkg</th><th>ΔBMI</th></tr>'
    logs.forEach((l, i) => {
      const p = i ? logs[i-1] : null
      h += `<tr><td>${l.d}</td><td>${l.w}</td><td>${l.bmi}</td><td>${p ? (l.w > p.w ? `<span class="up">↑ +${(l.w-p.w).toFixed(2)}</span>` : `<span class="down">↓ ${(l.w-p.w).toFixed(2)}</span>`) : ''}</td><td>${p ? (l.bmi > p.bmi ? `<span class="up">↑ +${(l.bmi-p.bmi).toFixed(2)}</span>` : `<span class="down">↓ ${(l.bmi-p.bmi).toFixed(2)}</span>`) : ''}</td></tr>`
    })
    h += '</table>'
    wHist.innerHTML = h
    new Chart(document.getElementById('bmi-chart').getContext('2d'), {
      type: 'line',
      data: {
        labels: logs.map(l => l.d),
        datasets: [{label:'BMI', data: logs.map(l => l.bmi), borderColor:'#0ea5e9', backgroundColor:'rgba(14,165,233,0.2)'}]
      },
      options: {scales: {y: {beginAtZero: false}}}
    })
  }

  function calcTarget() {
    const n = profile.currentWeight - profile.targetWeight
    if (n <= 0) return mTarget.innerHTML = '<p>No loss needed.</p>'
    const m = (0.75*4).toFixed(1)
    const s = Math.ceil(n/5)
    let h = `<p>Monthly: ${m} kg</p><ul>`
    for (let i = 1; i <= s; i++) h += `<li>Stage ${i}: ${(profile.currentWeight - i*5).toFixed(1)} kg</li>`
    h += '</ul>'
    mTarget.innerHTML = h
  }

  function genRoutine() {
    const {sex, age, height, fitnessLevel: l} = profile
    const hm = height/100, k = sex==='male'?0.415:sex==='female'?0.413:0.414, sl = hm*k
    const ts = age<60 ? (sex==='male'?9000:sex==='female'?8000:8500) : (sex==='male'?7000:sex==='female'?6000:6500)
    const sp = l==='low'?0.4:l==='medium'?0.6:0.8, inc = l==='low'?0.1:l==='medium'?0.05:0.025
    baseSp = l==='low'?3:l==='medium'?4:5
    maxSp = baseSp + (l==='low'?2:l==='medium'?3:4)
    let h = `<p>Target steps: ${ts}</p><p>Stride: ${(sl*100).toFixed(1)} cm</p><table><tr><th>Weeks</th><th>Steps</th><th>Min</th></tr>`
    let cp = sp
    for (let i = 1; i <= 12; i += 2) {
      const s = Math.round(ts*cp), d = (s*sl)/1000, t = Math.round(d/baseSp*60)
      h += `<tr><td>${i}-${Math.min(i+1,12)}</td><td>${s}</td><td>${t}</td></tr>`
      cp = Math.min(1, cp + inc*2)
    }
    h += '</table>'
    rOut.innerHTML = h
  }

  function showDaily() {
    let h = ''
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const ds = d.toISOString().split('T')[0]
      const ch = daily[ds] ? 'checked' : ''
      h += `<div class="daily-checkbox"><input type="checkbox" id="d${ds}" ${ch} onchange="toggleD('${ds}')"><label for="d${ds}">${d.toLocaleDateString('en-US',{weekday:'short',day:'numeric'})}</label></div>`
    }
    dailyGrid.innerHTML = h
  }

  window.toggleD = ds => {
    daily[ds] = document.getElementById(`d${ds}`).checked
    localStorage.setItem('daily', JSON.stringify(daily))
  }

  startBtn.onclick = () => {
    if (aCtx) aCtx.resume()
    hud.style.display = 'block'
    startBtn.style.display = 'none'
    sTime = phTime = 0
    phase = 'warmup'
    isPaused = false
    pauseBtn.textContent = 'Pause'
    updateH()
    tInterval = setInterval(() => {
      if (!isPaused) {
        sTime++
        phTime++
        updateH()
      }
    }, 1000)
  }

  pauseBtn.onclick = () => {
    if (isPaused) {
      tInterval = setInterval(() => { sTime++; phTime++; updateH() }, 1000)
      pauseBtn.textContent = 'Pause'
      isPaused = false
    } else {
      clearInterval(tInterval)
      pauseBtn.textContent = 'Resume'
      isPaused = true
    }
  }

  stopBtn.onclick = () => {
    clearInterval(tInterval)
    hud.style.display = 'none'
    startBtn.style.display = 'block'
    const t = new Date().toISOString().split('T')[0]
    daily[t] = true
    localStorage.setItem('daily', JSON.stringify(daily))
    showDaily()
    beep(440,300,0.4,'sine')
    alert('Done!')
  }

  function updateH() {
    const m = Math.floor(sTime/60).toString().padStart(2,'0')
    const s = (sTime%60).toString().padStart(2,'0')
    timerEl.textContent = `${m}:${s}`
    let spd, cue = false, f = 800
    if (phase === 'warmup') {
      phaseEl.textContent = 'Warm-up'
      spd = baseSp + (phTime/300)*(maxSp-baseSp)
      if (phTime >= 300) { phase = 'main'; phTime = 0; cue = true; f = 1000 }
      else if (Math.floor(phTime/60) !== Math.floor((phTime-1)/60)) { cue = true; f = 700 }
    } else if (phase === 'main') {
      phaseEl.textContent = 'Main'
      const iv = Math.floor(phTime/60) % 2
      spd = iv === 0 ? maxSp : baseSp + 1
      if (Math.floor(phTime/60) !== Math.floor((phTime-1)/60)) { cue = true; f = iv === 0 ? 950 : 650 }
      if (sTime >= 1200) { phase = 'cooldown'; phTime = 0; cue = true; f = 400 }
    } else if (phase === 'cooldown') {
      phaseEl.textContent = 'Cool-down'
      spd = maxSp - (phTime/300)*(maxSp-baseSp)
      if (phTime >= 300) return stopBtn.click()
    }
    speedEl.textContent = `Speed: ${spd.toFixed(1)} km/h`
    if (cue) {
      beep(f,180,0.35,'sine')
      speedEl.classList.add('flash')
      setTimeout(() => speedEl.classList.remove('flash'), 400)
    }
  }

  // Initial calls
  if (Object.keys(profile).length) suggestBpm()
})
