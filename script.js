document.addEventListener('DOMContentLoaded', () => {
    const profileForm = document.getElementById('profile-form');
    const weightLogForm = document.getElementById('weight-log-form');
    const monthlyTargetDiv = document.getElementById('monthly-target');
    const weightHistoryDiv = document.getElementById('weight-history');
    const routineOutputDiv = document.getElementById('routine-output');
    const bmiChartCanvas = document.getElementById('bmi-chart').getContext('2d');
    const startWorkoutBtn = document.getElementById('start-workout');
    const workoutHud = document.getElementById('workout-hud');
    const timerDisplay = document.getElementById('timer-display');
    const speedPrompt = document.getElementById('speed-prompt');
    const phaseDisplay = document.getElementById('phase');
    const stopWorkoutBtn = document.getElementById('stop-workout');
    const dailyLogDiv = document.getElementById('daily-log');

    let profile = JSON.parse(localStorage.getItem('profile')) || {};
    let weightLogs = JSON.parse(localStorage.getItem('weightLogs')) || [];
    let dailyCompletions = JSON.parse(localStorage.getItem('dailyCompletions')) || {};
    let timerInterval, sessionTimer = 0, currentPhase = 'warmup', phaseTime = 0;
    let baseSpeed, maxSpeed;

    // Audio
    let audioCtx = null;

    function playBeep(frequency = 800, duration = 150, volume = 0.3, type = 'sine') {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
        }
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        gainNode.gain.value = volume;
        const now = audioCtx.currentTime;
        oscillator.start(now);
        oscillator.stop(now + duration / 1000);
    }

    // Load profile if exists
    if (Object.keys(profile).length > 0) {
        document.getElementById('sex').value = profile.sex;
        document.getElementById('age').value = profile.age;
        document.getElementById('height').value = profile.height;
        document.getElementById('current-weight').value = profile.currentWeight;
        document.getElementById('target-weight').value = profile.targetWeight;
        document.getElementById('fitness-level').value = profile.fitnessLevel;
        calculateMonthlyTarget();
        generateRoutine();
        displayWeightHistory();
        displayDailyLog();
    }

    profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        profile = {
            sex: document.getElementById('sex').value,
            age: parseInt(document.getElementById('age').value),
            height: parseFloat(document.getElementById('height').value),
            currentWeight: parseFloat(document.getElementById('current-weight').value),
            targetWeight: parseFloat(document.getElementById('target-weight').value),
            fitnessLevel: document.getElementById('fitness-level').value
        };
        localStorage.setItem('profile', JSON.stringify(profile));
        calculateMonthlyTarget();
        generateRoutine();
        logWeight(profile.currentWeight);
        displayDailyLog();
    });

    weightLogForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const weight = parseFloat(document.getElementById('log-weight').value);
        logWeight(weight);
        document.getElementById('log-weight').value = '';
    });

    function logWeight(weight) {
        const date = new Date().toLocaleDateString();
        const heightM = profile.height / 100;
        const bmi = (weight / (heightM * heightM)).toFixed(2);
        weightLogs.push({ date, weight, bmi });
        localStorage.setItem('weightLogs', JSON.stringify(weightLogs));
        displayWeightHistory();
    }

    function displayWeightHistory() {
        if (weightLogs.length === 0) return;
        let html = '<table><tr><th>Date</th><th>Weight</th><th>BMI</th><th>Δ Weight</th><th>Δ BMI</th></tr>';
        for (let i = 0; i < weightLogs.length; i++) {
            const log = weightLogs[i];
            let wChange = '', bChange = '';
            if (i > 0) {
                const prev = weightLogs[i-1];
                const wDiff = log.weight - prev.weight;
                const bDiff = log.bmi - prev.bmi;
                wChange = wDiff > 0 ? `<span class="up">↑ +${wDiff.toFixed(2)}</span>` : `<span class="down">↓ ${wDiff.toFixed(2)}</span>`;
                bChange = bDiff > 0 ? `<span class="up">↑ +${bDiff.toFixed(2)}</span>` : `<span class="down">↓ ${bDiff.toFixed(2)}</span>`;
            }
            html += `<tr><td>${log.date}</td><td>${log.weight}</td><td>${log.bmi}</td><td>${wChange}</td><td>${bChange}</td></tr>`;
        }
        html += '</table>';
        weightHistoryDiv.innerHTML = html;

        const labels = weightLogs.map(log => log.date);
        const bmis = weightLogs.map(log => log.bmi);
        new Chart(bmiChartCanvas, {
            type: 'line',
            data: { labels, datasets: [{ label: 'BMI', data: bmis, borderColor: '#ff6b6b', backgroundColor: 'rgba(255,107,107,0.2)' }] },
            options: { scales: { y: { beginAtZero: false } } }
        });
    }

    function calculateMonthlyTarget() {
        const lossNeeded = profile.currentWeight - profile.targetWeight;
        if (lossNeeded <= 0) {
            monthlyTargetDiv.innerHTML = '<p>No loss needed! Maintain or gain sensibly.</p>';
            return;
        }
        const monthlyTarget = (0.75 * 4).toFixed(1);
        const stages = Math.ceil(lossNeeded / 5);
        let html = `<p>Sensible Monthly Target Loss: ${monthlyTarget} kg</p><p>Stages:</p><ul>`;
        for (let i = 1; i <= stages; i++) {
            html += `<li>Stage ${i}: Reach ${(profile.currentWeight - i * 5).toFixed(1)} kg</li>`;
        }
        html += '</ul>';
        monthlyTargetDiv.innerHTML = html;
    }

    function generateRoutine() {
        const { sex, age, height, fitnessLevel } = profile;
        const heightM = height / 100;
        const k = sex === 'male' ? 0.415 : sex === 'female' ? 0.413 : 0.414;
        const stepLengthM = heightM * k;

        let targetSteps = (age < 60) ? (sex === 'male' ? 9000 : sex === 'female' ? 8000 : 8500)
                                     : (sex === 'male' ? 7000 : sex === 'female' ? 6000 : 6500);

        let startPercent = fitnessLevel === 'low' ? 0.4 : fitnessLevel === 'medium' ? 0.6 : 0.8;
        const increment = fitnessLevel === 'low' ? 0.1 : fitnessLevel === 'medium' ? 0.05 : 0.025;

        baseSpeed = fitnessLevel === 'low' ? 3 : fitnessLevel === 'medium' ? 4 : 5;
        maxSpeed = baseSpeed + (fitnessLevel === 'low' ? 2 : fitnessLevel === 'medium' ? 3 : 4);

        let html = `<p>Target Daily Steps: ${targetSteps}</p><p>Step Length: ${(stepLengthM * 100).toFixed(1)} cm</p>`;
        html += `<p>12-Week Plan (base ${baseSpeed} km/h → up to ${maxSpeed} km/h):</p><table><tr><th>Weeks</th><th>Steps</th><th>Time (min)</th></tr>`;

        let currentPercent = startPercent;
        for (let i = 1; i <= 12; i += 2) {
            const steps = Math.round(targetSteps * currentPercent);
            const distanceKm = (steps * stepLengthM) / 1000;
            const timeMin = Math.round((distanceKm / baseSpeed) * 60);
            html += `<tr><td>${i}-${Math.min(i+1,12)}</td><td>${steps}</td><td>${timeMin}</td></tr>`;
            currentPercent = Math.min(1, currentPercent + increment * 2);
        }
        html += '</table><p>During sessions: speeds vary ${baseSpeed}–${maxSpeed} km/h with audio cues!</p>';
        routineOutputDiv.innerHTML = html;
    }

    // Daily completion
    function displayDailyLog() {
        let html = '';
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const checked = dailyCompletions[dateStr] ? 'checked' : '';
            html += `
                <div class="daily-checkbox">
                    <input type="checkbox" id="check-${dateStr}" ${checked} onchange="toggleCompletion('${dateStr}')">
                    <label for="check-${dateStr}">${date.toLocaleDateString('en-US', {weekday:'short', day:'numeric'})}</label>
                </div>`;
        }
        dailyLogDiv.innerHTML = html;
    }

    window.toggleCompletion = function(dateStr) {
        const cb = document.getElementById(`check-${dateStr}`);
        dailyCompletions[dateStr] = cb.checked;
        localStorage.setItem('dailyCompletions', JSON.stringify(dailyCompletions));
    };

    // Workout session
    startWorkoutBtn.addEventListener('click', startWorkout);
    stopWorkoutBtn.addEventListener('click', stopWorkout);

    function startWorkout() {
        if (audioCtx) audioCtx.resume();
        workoutHud.style.display = 'block';
        startWorkoutBtn.style.display = 'none';
        sessionTimer = phaseTime = 0;
        currentPhase = 'warmup';
        playBeep(600, 200, 0.4, 'sine'); // start tone
        updateHud();
        timerInterval = setInterval(() => {
            sessionTimer++;
            phaseTime++;
            updateHud();
        }, 1000);
    }

    function stopWorkout() {
        clearInterval(timerInterval);
        workoutHud.style.display = 'none';
        startWorkoutBtn.style.display = 'block';
        const today = new Date().toISOString().split('T')[0];
        dailyCompletions[today] = true;
        localStorage.setItem('dailyCompletions', JSON.stringify(dailyCompletions));
        displayDailyLog();
        playBeep(440, 300, 0.4, 'sine'); // finish tone
        alert('Workout complete! Marked as done. 🎉');
    }

    function updateHud() {
        const min = Math.floor(sessionTimer / 60).toString().padStart(2,'0');
        const sec = (sessionTimer % 60).toString().padStart(2,'0');
        timerDisplay.textContent = `${min}:${sec}`;

        let speed, playCue = false, freq = 800;

        if (currentPhase === 'warmup') {
            phaseDisplay.textContent = 'Warm-up';
            speed = baseSpeed + (phaseTime / 300) * (maxSpeed - baseSpeed);
            if (phaseTime >= 300) {
                currentPhase = 'main'; phaseTime = 0;
                playCue = true; freq = 1000;
            } else if (Math.floor(phaseTime / 60) !== Math.floor((phaseTime-1)/60)) {
                playCue = true; freq = 700;
            }
        } else if (currentPhase === 'main') {
            phaseDisplay.textContent = 'Main Workout';
            const interval = Math.floor(phaseTime / 60) % 2;
            speed = interval === 0 ? maxSpeed : baseSpeed + 1;
            if (Math.floor(phaseTime / 60) !== Math.floor((phaseTime-1)/60)) {
                playCue = true;
                freq = interval === 0 ? 950 : 650;
            }
            if (sessionTimer >= 1200) {
                currentPhase = 'cooldown'; phaseTime = 0;
                playCue = true; freq = 400;
            }
        } else if (currentPhase === 'cooldown') {
            phaseDisplay.textContent = 'Cool-down';
            speed = maxSpeed - (phaseTime / 300) * (maxSpeed - baseSpeed);
            if (phaseTime >= 300) {
                stopWorkout();
                return;
            }
        }

        speedPrompt.textContent = `Set speed to ${speed.toFixed(1)} km/h`;

        if (playCue) {
            playBeep(freq, 180, 0.35, 'sine');
            speedPrompt.classList.add('speed-change');
            setTimeout(() => speedPrompt.classList.remove('speed-change'), 400);
        }
    }

    // Spotify Web Playback SDK
    let spotifyPlayer = null;
    let spotifyToken = null;

    window.onSpotifyWebPlaybackSDKReady = () => {
        console.log('Spotify SDK loaded');
    };

    document.getElementById('connect-spotify').addEventListener('click', async () => {
        spotifyToken = prompt("Paste Spotify access token (with 'streaming' scope):");
        if (!spotifyToken) return;

        spotifyPlayer = new Spotify.Player({
            name: 'FitTrack Treadmill Player',
            getOAuthToken: cb => cb(spotifyToken),
            volume: 0.5
        });

        spotifyPlayer.addListener('ready', ({ device_id }) => {
            document.getElementById('player-status').textContent = 'Connected! Select this device in Spotify app.';
            document.getElementById('play-pause').disabled = false;
            document.getElementById('next-track').disabled = false;
            document.getElementById('play-playlist').disabled = false;
        });

        spotifyPlayer.addListener('not_ready', () => {
            document.getElementById('player-status').textContent = 'Disconnected';
        });

        await spotifyPlayer.connect();
    });

    document.getElementById('play-pause').addEventListener('click', () => spotifyPlayer?.togglePlay());
    document.getElementById('next-track').addEventListener('click', () => spotifyPlayer?.nextTrack());

    document.getElementById('play-playlist').addEventListener('click', () => {
        const uri = document.getElementById('playlist-uri').value.trim();
        if (uri && spotifyPlayer && spotifyToken) {
            fetch('https://api.spotify.com/v1/me/player/play', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${spotifyToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ context_uri: uri })
            }).then(res => {
                if (res.ok) console.log('Playback started');
                else alert('Error – check token, scopes, or Premium status');
            });
        }
    });
});
