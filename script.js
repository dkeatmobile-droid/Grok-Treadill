addEventListener('DOMContentLoaded', () => {
  const pForm = document.getElementById('profile-form')
  const wForm = document.getElementById('weight-log-form')
  const mTarget = document.getElementById('monthly-target')
  const wHist = document.getElementById('weight-history')
  const startDateInput = document.getElementById('start-date')
  const setStartBtn = document.getElementById('set-start-date')
  const calendarContainer = document.getElementById('calendar-container')
  const progressInfo = document.getElementById('progress-info')
  const startBtn = document.getElementById('start-workout')
  const hud = document.getElementById('workout-hud')
  const timerEl = document.getElementById('timer-display')
  const speedEl = document.getElementById('speed-prompt')
  const phaseEl = document.getElementById('phase')
  const pauseBtn = document.getElementById('pause-workout')
  const stopBtn = document.getElementById('stop-workout')

  let profile = JSON.parse(localStorage.getItem('p')) || {}
  let logs = JSON.parse(localStorage.getItem('logs')) || []
  let completions = JSON.parse(localStorage.getItem('completions')) || {}
  let startDate = localStorage.getItem('startDate')
  let tInterval, sTime = 0, phTime = 0, phase = 'warmup'
  let baseMph, maxMph, aCtx = null, isPaused = false

  if (startDate) {
    startDateInput.value = startDate
    renderCalendar()
  }

  // Profile
  pForm.onsubmit = e => {
    e.preventDefault()
    profile = {
      sex: document.getElementById('sex').value,
      age: +document.getElementById('age').value,
      height: +document.getElementById('height').value,
      currentWeight: +document.getElementById('current-weight').value,
      targetWeight: +document.getElementById('target-weight').value,
      fitnessLevel: document.getElementById('fitness-level').value
    }
    localStorage.setItem('p', JSON.stringify(profile))
    calcTarget()
    logW(profile.currentWeight)
    renderCalendar()
  }

  // Weight log
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

  function deleteLog(index) {
    if (confirm('Delete this entry?')) {
      logs.splice(index, 1)
      localStorage.setItem('logs', JSON.stringify(logs))
      showLogs()
    }
  }

  function showLogs() {
    if (!logs.length) {
      wHist.innerHTML = '<p>No entries yet.</p>'
      return
    }
    let h = '<div class="table-container"><table><tr><th>Date</th><th>kg</th><th>BMI</th><th>Δkg</th><th>ΔBMI</th><th></th></tr>'
    logs.forEach((l, i) => {
      const p = i ? logs[i-1] : null
      h += `<tr>
        <td>${l.d}</td>
        <td>${l.w}</td>
        <td>${l.bmi}</td>
        <td>${p ? (l.w > p.w ? `<span class="up">↑ +${(l.w-p.w).toFixed(2)}</span>` : `<span class="down">↓ ${(l.w-p.w).toFixed(2)}</span>`) : ''}</td>
        <td>${p ? (l.bmi > p.bmi ? `<span class="up">↑ +${(l.bmi-p.bmi).toFixed(2)}</span>` : `<span class="down">↓ ${(l.bmi-p.bmi).toFixed(2)}</span>`) : ''}</td>
        <td><button class="delete-btn" onclick="deleteLog(${i})" title="Delete entry">🗑</button></td>
      </tr>`
    })
    h += '</table></div>'
    wHist.innerHTML = h

    new Chart(document.getElementById('bmi-chart').getContext('2d'), {
      type: 'line',
      data: {
        labels: logs.map(l => l.d),
        datasets: [{label:'BMI', data: logs.map(l => l.bmi), borderColor:'#0ea5e9', backgroundColor:'rgba(14,165,233,0.2)'}]
      },
      options: {scales: {y: {beginAtZero: false}}, responsive: true, maintainAspectRatio: false}
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

  // Calendar functions
  setStartBtn.onclick = () => {
    if (!startDateInput.value) return alert('Select a start date')
    startDate = startDateInput.value
    localStorage.setItem('startDate', startDate)
    completions = {} // reset completions when changing start date
    localStorage.setItem('completions', JSON.stringify(completions))
    renderCalendar()
  }

  function renderCalendar() {
    if (!startDate) {
      progressInfo.textContent = 'Set a start date to see your plan'
      calendarContainer.innerHTML = ''
      return
    }

    const start = new Date(startDate)
    const today = new Date()
    today.setHours(0,0,0,0)

    let html = ''
    let current = new Date(start)
    let week = 1

    while (week <= 12) {
      const monthName = current.toLocaleString('default', { month: 'long', year: 'numeric' })
      let monthHtml = `<div class="calendar-month"><h3>${monthName}</h3><div class="calendar-grid">`

      // Day names
      ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d => {
        monthHtml += `<div class="day-name">${d}</div>`
      })

      // Empty days before 1st
      const firstDay = new Date(current.getFullYear(), current.getMonth(), 1)
      let dayOfWeek = firstDay.getDay() || 7
      for (let i = 1; i < dayOfWeek; i++) monthHtml += '<div></div>'

      // Days
      const daysInMonth = new Date(current.getFullYear(), current.getMonth()+1, 0).getDate()
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(current.getFullYear(), current.getMonth(), d)
        const dateStr = date.toISOString().split('T')[0]
        const daysSince = Math.floor((date - start) / (86400000))
        const weekNum = Math.floor(daysSince / 7) + 1

        let className = 'calendar-day'
        let content = `<div class="date">${d}</div>`

        if (date < start) {
          className += ' past'
        } else if (date > today) {
          className += ' future'
        } else {
          const goal = getGoalMilesForWeek(weekNum)
          content += `<div class="miles">${goal.toFixed(1)} mi</div>`

          if (completions[dateStr]?.completed) {
            className += ' completed'
          } else if (date < today) {
            className += ' missed'
          } else {
            content += `<input type="checkbox" ${completions[dateStr]?.completed ? 'checked' : ''} onchange="toggleCompletion('${dateStr}', this.checked)">`
          }
        }

        monthHtml += `<div class="${className}">${content}</div>`
      }

      monthHtml += '</div></div>'
      html += monthHtml

      current.setMonth(current.getMonth() + 1)
      week += 4 // roughly one month
    }

    calendarContainer.innerHTML = html
    updateProgressInfo()
  }

  function getGoalMilesForWeek(week) {
    if (!profile.fitnessLevel) return 0
    const l = profile.fitnessLevel
    const base = l==='low' ? 2.0 : l==='medium' ? 3.0 : 4.0
    const max = l==='low' ? 3.2 : l==='medium' ? 4.9 : 6.5
    const progress = Math.min(1, (week-1) / 11)
    return base + progress * (max - base)
  }

  window.toggleCompletion = (dateStr, completed) => {
    completions[dateStr] = {completed}
    localStorage.setItem('completions', JSON.stringify(completions))
    renderCalendar()
  }

  function updateProgressInfo() {
    if (!startDate) return
    const daysSince = Math.floor((new Date() - new Date(startDate)) / (86400000))
    const weeks = Math.floor(daysSince / 7) + 1
    progressInfo.textContent = `Week ${Math.min(weeks,12)} of 12 • ${daysSince} days since start`
  }

  // Workout timer logic (unchanged except mph)
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
    completions[t] = {completed: true}
    localStorage.setItem('completions', JSON.stringify(completions))
    renderCalendar()
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
      spd = baseMph + (phTime/300)*(maxMph-baseMph)
      if (phTime >= 300) { phase = 'main'; phTime = 0; cue = true; f = 1000 }
      else if (Math.floor(phTime/60) !== Math.floor((phTime-1)/60)) { cue = true; f = 700 }
    } else if (phase === 'main') {
      phaseEl.textContent = 'Main'
      const iv = Math.floor(phTime/60) % 2
      spd = iv === 0 ? maxMph : baseMph + 0.6
      if (Math.floor(phTime/60) !== Math.floor((phTime-1)/60)) { cue = true; f = iv === 0 ? 950 : 650 }
      if (sTime >= 1200) { phase = 'cooldown'; phTime = 0; cue = true; f = 400 }
    } else if (phase === 'cooldown') {
      phaseEl.textContent = 'Cool-down'
      spd = maxMph - (phTime/300)*(maxMph-baseMph)
      if (phTime >= 300) return stopBtn.click()
    }
    speedEl.textContent = `Speed: ${spd.toFixed(1)} mph`
    if (cue) {
      beep(f,180,0.35,'sine')
      speedEl.classList.add('flash')
      setTimeout(() => speedEl.classList.remove('flash'), 400)
    }
  }

  // Initial render
  renderCalendar()
})