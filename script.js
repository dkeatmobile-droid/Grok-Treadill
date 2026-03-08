document.addEventListener('DOMContentLoaded', () => {
    const profileForm = document.getElementById('profile-form');
    const weightLogForm = document.getElementById('weight-log-form');
    const monthlyTargetDiv = document.getElementById('monthly-target');
    const weightHistoryDiv = document.getElementById('weight-history');
    const routineOutputDiv = document.getElementById('routine-output');
    const bmiChartCanvas = document.getElementById('bmi-chart').getContext('2d');

    let profile = JSON.parse(localStorage.getItem('profile')) || {};
    let weightLogs = JSON.parse(localStorage.getItem('weightLogs')) || [];

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
        // Log initial weight
        logWeight(profile.currentWeight);
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
        let html = '<table><tr><th>Date</th><th>Weight (kg)</th><th>BMI</th><th>Weight Change</th><th>BMI Change</th></tr>';
        for (let i = 0; i < weightLogs.length; i++) {
            const log = weightLogs[i];
            let weightChange = '', bmiChange = '';
            if (i > 0) {
                const prev = weightLogs[i-1];
                const wDiff = log.weight - prev.weight;
                const bDiff = log.bmi - prev.bmi;
                weightChange = wDiff > 0 ? `<span class="up">↑ +${wDiff.toFixed(2)}</span>` : `<span class="down">↓ ${wDiff.toFixed(2)}</span>`;
                bmiChange = bDiff > 0 ? `<span class="up">↑ +${bDiff.toFixed(2)}</span>` : `<span class="down">↓ ${bDiff.toFixed(2)}</span>`;
            }
            html += `<tr><td>${log.date}</td><td>${log.weight}</td><td>${log.bmi}</td><td>${weightChange}</td><td>${bmiChange}</td></tr>`;
        }
        html += '</table>';
        weightHistoryDiv.innerHTML = html;

        // Chart
        const labels = weightLogs.map(log => log.date);
        const bmis = weightLogs.map(log => log.bmi);
        new Chart(bmiChartCanvas, {
            type: 'line',
            data: {
                labels,
                datasets: [{ label: 'BMI', data: bmis, borderColor: '#ff6b6b', backgroundColor: 'rgba(255,107,107,0.2)' }]
            },
            options: { scales: { y: { beginAtZero: false } } }
        });
    }

    function calculateMonthlyTarget() {
        const lossNeeded = profile.currentWeight - profile.targetWeight;
        if (lossNeeded <= 0) {
            monthlyTargetDiv.innerHTML = '<p>No loss needed! Maintain or gain sensibly.</p>';
            return;
        }
        const safeWeeklyLoss = 0.75; // kg
        const monthlyTarget = (safeWeeklyLoss * 4).toFixed(1);
        const stages = Math.ceil(lossNeeded / 5); // Every 5kg stage
        let stageHtml = '<p>Sensible Monthly Target Loss: ' + monthlyTarget + ' kg</p><p>Stages:</p><ul>';
        for (let i = 1; i <= stages; i++) {
            const stageWeight = (profile.currentWeight - i * 5).toFixed(1);
            stageHtml += `<li>Stage ${i}: Reach ${stageWeight} kg</li>`;
        }
        stageHtml += '</ul>';
        monthlyTargetDiv.innerHTML = stageHtml;
    }

    function generateRoutine() {
        const { sex, age, height, fitnessLevel } = profile;
        const heightM = height / 100;
        const k = sex === 'male' ? 0.415 : sex === 'female' ? 0.413 : 0.414;
        const stepLengthM = heightM * k;

        // Target steps
        let targetSteps;
        if (age < 60) {
            targetSteps = sex === 'male' ? 9000 : sex === 'female' ? 8000 : 8500;
        } else {
            targetSteps = sex === 'male' ? 7000 : sex === 'female' ? 6000 : 6500;
        }

        // Starting percent and increment
        let startPercent = fitnessLevel === 'low' ? 0.4 : fitnessLevel === 'medium' ? 0.6 : 0.8;
        const increment = fitnessLevel === 'low' ? 0.1 : fitnessLevel === 'medium' ? 0.05 : 0.025;
        const weeks = 12;

        // Speed km/h
        const speedKmh = fitnessLevel === 'low' ? 3 : fitnessLevel === 'medium' ? 4 : 5;

        let html = `<p>Target Daily Steps: ${targetSteps}</p><p>Step Length: ${(stepLengthM * 100).toFixed(1)} cm</p><p>12-Week Treadmill Plan (Daily, at ${speedKmh} km/h):</p><table><tr><th>Weeks</th><th>Steps</th><th>Time (min)</th></tr>`;
        let currentPercent = startPercent;
        for (let i = 1; i <= weeks; i += 2) {
            const steps = Math.round(targetSteps * currentPercent);
            const distanceKm = (steps * stepLengthM) / 1000;
            const timeHours = distanceKm / speedKmh;
            const timeMin = Math.round(timeHours * 60);
            html += `<tr><td>${i}-${i+1}</td><td>${steps}</td><td>${timeMin}</td></tr>`;
            currentPercent = Math.min(1, currentPercent + increment * 2); // Every 2 weeks
        }
        html += '</table><p>Pro Tip: Add incline 1-2% after week 4 for extra challenge. Track your steps and adjust!</p>';
        routineOutputDiv.innerHTML = html;
    }
});
