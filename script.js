document.addEventListener('DOMContentLoaded', () => {
    // Initial Data Fetch
    let tasks = JSON.parse(localStorage.getItem('smartStudyTasks')) || [];
    let subjects = JSON.parse(localStorage.getItem('smartStudySubjects')) || [];
    let assignmentData = JSON.parse(localStorage.getItem('smartStudyAssignments')) || {};
    let streakData = JSON.parse(localStorage.getItem('smartStudyStreak')) || { count: 0, lastLogin: null };
    let codingData = JSON.parse(localStorage.getItem('smartStudyCoding')) || { date: null, progress: { leetcode: false, hackerrank: false, gfg: false } };

    // Dashboard & Filters State
    let currentTaskFilter = 'all';
    let emailPrefs = { enabled: false, reminderTime: '19:00', lastReminderSent: null };

    // --- 0. Login System (Google GIS) ---
    let currentUser = null;
    try {
        currentUser = JSON.parse(localStorage.getItem('smartStudyUser'));
        if (typeof currentUser === 'string') {
            throw new Error('Old user format'); // Trigger catch block to clear old string format
        }
    } catch (e) {
        localStorage.removeItem('smartStudyUser'); // Clear old manual login data
        currentUser = null;
    }

    function loadUserData() {
        if (!currentUser || !currentUser.email) return;
        
        // Load user-specific data using prefix (use email as unique ID)
        const prefix = `smartStudy_${currentUser.email}_`;
        tasks = JSON.parse(localStorage.getItem(`${prefix}tasks`)) || [];
        subjects = JSON.parse(localStorage.getItem(`${prefix}subjects`)) || [];
        assignmentData = JSON.parse(localStorage.getItem(`${prefix}assignments`)) || {};
        streakData = JSON.parse(localStorage.getItem(`${prefix}streak`)) || { count: 0, lastLogin: null };
        codingData = JSON.parse(localStorage.getItem(`${prefix}coding`)) || { date: null, progress: { leetcode: false, hackerrank: false, gfg: false } };
        emailPrefs = JSON.parse(localStorage.getItem(`${prefix}emailPrefs`)) || { enabled: false, reminderTime: '19:00', lastReminderSent: null, setupDone: false, email: currentUser.email, frequency: 'daily' };
    }

    function saveUserData(key, data) {
        if (!currentUser || !currentUser.email) return;
        localStorage.setItem(`smartStudy_${currentUser.email}_${key}`, JSON.stringify(data));
    }

    function decodeJwtResponse(token) {
        let base64Url = token.split('.')[1];
        let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        let jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    }

    window.handleCredentialResponse = function(response) {
        const errorDiv = document.getElementById('login-error');
        if (errorDiv) errorDiv.style.display = 'none';

        try {
            if (!response || !response.credential) {
                throw new Error("No credential received");
            }
            const responsePayload = decodeJwtResponse(response.credential);
            if (!responsePayload || !responsePayload.email) {
                throw new Error("Invalid payload data");
            }
            
            currentUser = {
                name: responsePayload.name || "User",
                email: responsePayload.email
            };
            localStorage.setItem('smartStudyUser', JSON.stringify(currentUser));
            localStorage.setItem('isLoggedIn', 'true');
            window.location.reload();
        } catch (err) {
            console.error("Google Sign-In Error:", err);
            if (errorDiv) {
                errorDiv.textContent = "Login failed. Please try again.";
                errorDiv.style.display = 'block';
            }
        }
    };

    function initAuth() {
        const loginScreen = document.getElementById('login-screen');
        const mainNavbar = document.getElementById('main-navbar');
        const appContent = document.getElementById('app-content');
        const navUsername = document.getElementById('nav-username');
        const logoutBtn = document.getElementById('logout-btn');

        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

        if (isLoggedIn && currentUser && currentUser.email) {
            // User is logged in
            loginScreen.style.display = 'none';
            mainNavbar.style.display = 'block';
            appContent.style.display = 'block';
            navUsername.textContent = `👋 ${currentUser.name}`;
            
            const settingsBtn = document.getElementById('nav-settings-btn');
            if (settingsBtn) {
                settingsBtn.style.display = 'flex';
                settingsBtn.addEventListener('click', () => {
                    if (typeof openSettingsModal === 'function') {
                        openSettingsModal();
                    } else {
                        const modal = document.getElementById('email-setup-modal');
                        if (modal) modal.style.display = 'flex';
                    }
                });
            }
            
            // Initialize app features only after login
            initApp();
        } else {
            // Show login screen
            loginScreen.style.display = 'flex';
            mainNavbar.style.display = 'none';
            appContent.style.display = 'none';
            
            // Initialize Google Sign-In
            function renderGoogleButton() {
                if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
                    setTimeout(renderGoogleButton, 100);
                    return;
                }
                try {
                    google.accounts.id.initialize({
                        client_id: "876599030359-2fjtippq8fbksr4d6ccq3ccg660qi6kd.apps.googleusercontent.com", // Replace with actual Client ID
                        callback: handleCredentialResponse
                    });
                    google.accounts.id.renderButton(
                        document.getElementById("google-btn-container"),
                        { theme: "filled_black", size: "large", shape: "pill" }
                    );
                } catch (err) {
                    console.error("Failed to render Google button:", err);
                    const errorDiv = document.getElementById('login-error');
                    if (errorDiv) {
                        errorDiv.textContent = "Could not load Google Login.";
                        errorDiv.style.display = 'block';
                    }
                }
            }
            renderGoogleButton();
        }

        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Sign out from Google session safely
            try {
                if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
                    google.accounts.id.disableAutoSelect();
                    // Optionally revoke access to completely clear the session
                    if (currentUser && currentUser.email) {
                        google.accounts.id.revoke(currentUser.email, () => {
                            console.log('Google session revoked');
                        });
                    }
                }
            } catch(err) {
                console.warn('Google sign-out skipped or failed:', err);
            }

            // Clear current user data and reload to show login screen
            localStorage.removeItem('smartStudyUser');
            localStorage.setItem('isLoggedIn', 'false');
            currentUser = null;
            
            // Reset UI state to login screen immediately
            loginScreen.style.display = 'flex';
            mainNavbar.style.display = 'none';
            appContent.style.display = 'none';
            
            // Clear URL hash to ensure clean login page state
            history.pushState("", document.title, window.location.pathname + window.location.search);
            
            // Reload the page to ensure all in-memory states are reset completely
            window.location.reload();
        });
    }

    // Initialize the app features
    function initApp() {
        loadUserData(); // Load user-specific data first
        initStreak();
        initCodingTracker();
        renderSubjects();
        initTaskFilters();
        renderTasks();
        renderAssignments();
        initNavigation();
        initEmailNotifications();
        checkEmailOnboarding(); // Check if we need to show the email setup modal
        updateHomeSummaries(); // Make sure initial home summary is correct
        checkOverdueNotifications(); // Check for overdue tasks to send email
    }

    // Start Authentication flow
    initAuth();

    // DOM Elements
    const taskForm = document.getElementById('task-form');
    const subjectForm = document.getElementById('subject-form');

    // --- Navigation Highlight Feature ---
    function initNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');

        // Handle initial load hash
        if (window.location.hash) {
            navigateTo(window.location.hash.substring(1));
        }

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                navigateTo(targetId);
            });
        });
    }

    window.navigateTo = function(targetId) {
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        // Prevent navigation if not logged in
        if (!isLoggedIn || !currentUser || !currentUser.email) {
            return;
        }

        const sections = document.querySelectorAll('.page-section');
        const navLinks = document.querySelectorAll('.nav-link');
        
        // Hide all sections
        sections.forEach(section => {
            section.classList.remove('active');
        });

        // Show target section
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Update nav links
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === '#' + targetId) {
                link.classList.add('active');
            }
        });
        
        // Update URL hash without scrolling
        history.pushState(null, null, '#' + targetId);
        
        // Update home summaries if navigating to home
        if (targetId === 'home') {
            updateHomeSummaries();
        }
    };

    function updateHomeSummaries() {
        // Update Assignments Summary
        let totalAssignments = 0;
        let completedAssignments = 0;
        let subjectProgressHTML = '';
        
        Object.keys(assignmentData).forEach(subject => {
            if (Array.isArray(assignmentData[subject])) {
                let subjectTotal = 0;
                let subjectCompleted = 0;
                
                assignmentData[subject].forEach(status => {
                    subjectTotal++;
                    totalAssignments++;
                    if (status) {
                        subjectCompleted++;
                        completedAssignments++;
                    }
                });
                
                // Add subject breakdown for home page
                if (subjectTotal > 0) {
                    subjectProgressHTML += `
                        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 4px 8px; border-radius: 4px;">
                            <span style="font-weight: 500;">${subject}</span>
                            <span style="color: var(--primary-color);">${subjectCompleted}/${subjectTotal}</span>
                        </div>
                    `;
                }
            }
        });
        
        const assignmentSummaryText = document.getElementById('assignment-summary');
        if (assignmentSummaryText) {
            assignmentSummaryText.textContent = `${completedAssignments}/${totalAssignments} Total`;
        }

        const homeSubjectProgress = document.getElementById('home-subject-progress');
        if (homeSubjectProgress) {
            homeSubjectProgress.innerHTML = subjectProgressHTML;
        }

        // Update Coding Summary
        const today = new Date().toDateString();
        let completedCount = 0;
        let codingProgressHTML = '';
        
        if (codingData.date === today && codingData.progress) {
            completedCount = Object.values(codingData.progress).filter(Boolean).length;
            
            // Add individual platform breakdown
            const platforms = {
                'leetcode': 'LeetCode',
                'hackerrank': 'HackerRank',
                'gfg': 'GeeksforGeeks'
            };
            
            Object.keys(platforms).forEach(key => {
                const isCompleted = codingData.progress[key];
                codingProgressHTML += `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 4px 8px; border-radius: 4px;">
                        <span style="font-weight: 500;">${platforms[key]}</span>
                        <span style="color: ${isCompleted ? 'var(--primary-color)' : 'var(--text-muted)'};">${isCompleted ? 'Done ✓' : 'Pending'}</span>
                    </div>
                `;
            });
        }
        
        const codingSummaryHome = document.getElementById('coding-summary-home');
        if (codingSummaryHome) {
            codingSummaryHome.textContent = `${completedCount}/3 Completed Today`;
        }

        const homeCodingProgress = document.getElementById('home-coding-progress');
        if (homeCodingProgress) {
            homeCodingProgress.innerHTML = codingProgressHTML;
        }

        updateProductivityScore(completedAssignments, totalAssignments);
    }

    // --- Productivity Score Calculation ---
    function updateProductivityScore(completedAssignments, totalAssignments) {
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.completed).length;
        
        let totalWeight = 0;
        let earnedScore = 0;

        // 1. Tasks Weight (40%)
        if (totalTasks > 0) {
            totalWeight += 40;
            earnedScore += (completedTasks / totalTasks) * 40;
        }

        // 2. Assignments Weight (40%)
        if (totalAssignments > 0) {
            totalWeight += 40;
            earnedScore += (completedAssignments / totalAssignments) * 40;
        }

        // 3. Streak Weight (20%)
        // Target is 7 days for max streak score
        totalWeight += 20;
        earnedScore += Math.min(streakData.count / 7, 1) * 20;

        // Calculate final percentage
        const finalScore = totalWeight > 0 ? Math.round((earnedScore / totalWeight) * 100) : 0;

        // Update UI
        const scoreText = document.getElementById('productivity-score-text');
        const progressBar = document.getElementById('productivity-progress');
        
        if (scoreText && progressBar) {
            scoreText.textContent = `${finalScore}%`;
            progressBar.style.width = `${finalScore}%`;
            
            // Color coding based on score
            if (finalScore >= 80) {
                progressBar.style.background = 'var(--primary-color)'; // Emerald
            } else if (finalScore >= 50) {
                progressBar.style.background = 'var(--priority-medium)'; // Amber
            } else {
                progressBar.style.background = 'var(--priority-high)'; // Red
            }
        }
    }

    // --- 1. Daily Streak Feature ---
    function initStreak() {
        const today = new Date().toDateString();
        
        if (streakData.lastLogin !== today) {
            if (streakData.lastLogin) {
                const lastLoginDate = new Date(streakData.lastLogin);
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                
                // Check if last login was exactly yesterday
                if (lastLoginDate.toDateString() === yesterday.toDateString()) {
                    streakData.count++;
                } else {
                    // Missed a day
                    streakData.count = 1;
                }
            } else {
                // First ever login
                streakData.count = 1;
            }
            streakData.lastLogin = today;
            saveUserData('streak', streakData);
        }

        document.getElementById('streak-count').textContent = streakData.count;
        const lastLoginElement = document.getElementById('last-login');
        if (lastLoginElement) {
            lastLoginElement.textContent = streakData.lastLogin || '-';
        }
    }

    // --- 2. Coding Practice Tracker ---
    function initCodingTracker() {
        const today = new Date().toDateString();
        
        // Reset daily
        if (codingData.date !== today) {
            codingData = { date: today, progress: { leetcode: false, hackerrank: false, gfg: false } };
            saveUserData('coding', codingData);
        }

        ['leetcode', 'hackerrank', 'gfg'].forEach(platform => {
            const cb = document.getElementById(`${platform}-check`);
            if (cb) {
                cb.checked = codingData.progress[platform];
                cb.addEventListener('change', (e) => {
                    codingData.progress[platform] = e.target.checked;
                    saveUserData('coding', codingData);
                    updateCodingProgress();
                });
            }
        });

        updateCodingProgress();
    }

    function updateCodingProgress() {
        const count = Object.values(codingData.progress).filter(Boolean).length;
        document.getElementById('coding-progress').textContent = `${count}/3`;
        
        // Update Home summary if on home
        if (window.location.hash === '' || window.location.hash === '#home') {
            updateHomeSummaries();
        }
    }

    // --- 3. Dynamic Subjects Feature ---
    if (subjectForm) {
        subjectForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('new-subject');
            const subject = input.value.trim();
            
            if (subject && !subjects.includes(subject)) {
                subjects.push(subject);
                // Initialize assignments for new subject
                assignmentData[subject] = [false, false, false, false, false];
                saveSubjects();
                renderSubjects();
                renderAssignments();
                input.value = '';
            }
        });
    }

    function saveSubjects() {
        saveUserData('subjects', subjects);
        saveUserData('assignments', assignmentData);
    }

    function renderSubjects() {
        // Render tags list
        const subjectList = document.getElementById('subject-list');
        if (subjectList) {
            subjectList.innerHTML = '';
            subjects.forEach(subject => {
                const div = document.createElement('div');
                div.className = 'subject-tag';
                div.innerHTML = `
                    ${subject} 
                    <button type="button" class="btn-remove-subject" data-subject="${subject}">&times;</button>
                `;
                subjectList.appendChild(div);
            });
        }

        // Render select dropdown for Task form
        const subjectSelect = document.getElementById('task-subject');
        if (subjectSelect) {
            const currentValue = subjectSelect.value;
            subjectSelect.innerHTML = '<option value="" disabled selected>Select Subject</option>';
            subjects.forEach(subject => {
                const option = document.createElement('option');
                option.value = subject;
                option.textContent = subject;
                subjectSelect.appendChild(option);
            });
            // Restore selection if it still exists
            if (subjects.includes(currentValue)) {
                subjectSelect.value = currentValue;
            }
        }

        // Add event listeners for deleting subjects
        document.querySelectorAll('.btn-remove-subject').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const subject = e.target.getAttribute('data-subject');
                subjects = subjects.filter(s => s !== subject);
                delete assignmentData[subject];
                
                // Optionally remove tasks tied to this subject
                tasks = tasks.filter(t => t.subject !== subject);
                
                saveTasks();
                saveSubjects();
                renderSubjects();
                renderAssignments();
                renderTasks();
            });
        });
    }

    // --- 4. Assignment Tracker Feature ---
    function renderAssignments() {
        const container = document.getElementById('assignment-container');
        if (!container) return;

        container.innerHTML = '';

        if (subjects.length === 0) {
            container.innerHTML = '<p class="empty-state">Add subjects to track assignments.</p>';
            return;
        }

        subjects.forEach(subject => {
            const subjectAssignments = assignmentData[subject] || [false, false, false, false, false];
            const completedCount = subjectAssignments.filter(Boolean).length;

            const card = document.createElement('div');
            card.className = 'assignment-subject-card';
            
            let listHTML = '<ul class="assignment-list">';
            for (let i = 0; i < 5; i++) {
                listHTML += `
                    <li>
                        <label>
                            <input type="checkbox" class="assignment-cb" data-subject="${subject}" data-index="${i}" ${subjectAssignments[i] ? 'checked' : ''}>
                            Assignment ${i + 1}
                        </label>
                    </li>
                `;
            }
            listHTML += '</ul>';

            card.innerHTML = `
                <h3>${subject} <span class="assignment-progress">${completedCount}/5 completed</span></h3>
                ${listHTML}
            `;
            container.appendChild(card);
        });

        // Add event listeners for checkboxes
        document.querySelectorAll('.assignment-cb').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const subject = e.target.getAttribute('data-subject');
                const index = parseInt(e.target.getAttribute('data-index'));
                
                // Ensure array exists for safety
                if (!assignmentData[subject]) {
                    assignmentData[subject] = [false, false, false, false, false];
                }
                
                assignmentData[subject][index] = e.target.checked;
                saveSubjects();
                
                // Update the specific subject's progress text without full re-render
                const completedCount = assignmentData[subject].filter(Boolean).length;
                const progressSpan = e.target.closest('.assignment-subject-card').querySelector('.assignment-progress');
                if (progressSpan) {
                    progressSpan.textContent = `${completedCount}/5 completed`;
                }
                
                updateHomeSummaries(); // Keep home page up to date
            });
        });
    }

    // --- 5. Tasks Manager (Existing Feature Adapted) ---
    if (taskForm) {
        taskForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const subject = document.getElementById('task-subject').value;
            const name = document.getElementById('task-name').value.trim();
            const deadline = document.getElementById('task-deadline').value;
            const priority = document.getElementById('task-priority').value;

            if (subject && name && deadline) {
                const newTask = {
                    id: Date.now().toString(),
                    subject,
                    name,
                    deadline,
                    priority,
                    completed: false
                };

                tasks.push(newTask);
                saveTasks();
                renderTasks();
                updateHomeSummaries(); // Ensure chart gets the new task immediately
                taskForm.reset();
                document.getElementById('task-priority').value = 'Medium';
            }
        });
    }

    function saveTasks() {
        saveUserData('tasks', tasks);
    }

    function renderTasks() {
        const taskList = document.getElementById('task-list');
        if (!taskList) return;

        taskList.innerHTML = '';

        // Apply Filters
        let filteredTasks = tasks;
        if (currentTaskFilter === 'completed') {
            filteredTasks = tasks.filter(t => t.completed);
        } else if (currentTaskFilter === 'pending') {
            filteredTasks = tasks.filter(t => !t.completed);
        } else if (currentTaskFilter === 'high') {
            filteredTasks = tasks.filter(t => t.priority === 'High' && !t.completed);
        }

        if (filteredTasks.length === 0) {
            taskList.innerHTML = '<li class="empty-state">No tasks found.</li>';
            return;
        }

        const sortedTasks = [...filteredTasks].sort((a, b) => {
            if (a.completed === b.completed) {
                return new Date(a.deadline) - new Date(b.deadline);
            }
            return a.completed ? 1 : -1;
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        sortedTasks.forEach(task => {
            const taskDate = new Date(task.deadline);
            taskDate.setHours(0, 0, 0, 0);
            
            const isOverdue = !task.completed && taskDate < today;

            const li = document.createElement('li');
            li.className = `task-item ${task.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`;
            
            li.innerHTML = `
                <div class="task-details">
                    <input type="checkbox" class="task-checkbox" data-id="${task.id}" ${task.completed ? 'checked' : ''}>
                    <div class="task-content">
                        <span class="task-title">${task.name}</span>
                        <div class="task-meta">
                            <span class="task-subject">📚 ${task.subject}</span>
                            <span class="task-deadline">📅 ${formatDate(task.deadline)}</span>
                            <span class="task-priority priority-${task.priority}">${task.priority}</span>
                            ${isOverdue ? '<span class="overdue-label">Overdue</span>' : ''}
                        </div>
                    </div>
                </div>
                <button class="btn-delete" data-id="${task.id}">Delete</button>
            `;

            taskList.appendChild(li);
        });

        // Add event listeners for dynamic elements
        document.querySelectorAll('.task-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const taskId = e.target.getAttribute('data-id');
                tasks = tasks.map(task => task.id === taskId ? { 
                    ...task, 
                    completed: !task.completed,
                    completedDate: !task.completed ? new Date().toISOString() : null
                } : task);
                saveTasks();
                renderTasks();
                updateHomeSummaries(); // Always update dashboard
            });
        });

        document.querySelectorAll('.btn-delete').forEach(button => {
            button.addEventListener('click', (e) => {
                const taskId = e.target.getAttribute('data-id');
                tasks = tasks.filter(task => task.id !== taskId);
                saveTasks();
                renderTasks();
                updateHomeSummaries(); // Always update dashboard
            });
        });
    }

    function formatDate(dateString) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        const date = new Date(dateString);
        return date.toLocaleDateString(undefined, options);
    }

    // --- 6. Task Filters ---
    function initTaskFilters() {
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update active class
                filterBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                // Update filter state and render
                currentTaskFilter = e.target.getAttribute('data-filter');
                renderTasks();
            });
        });
    }

    // --- 8. AI Assignment Assistant ---
    const btnGenerateAI = document.getElementById('btn-generate-ai');
    const aiPrompt = document.getElementById('ai-prompt');
    const chatContainer = document.getElementById('chat-container');

    if (btnGenerateAI && aiPrompt && chatContainer) {
        
        // Auto-resize textarea
        aiPrompt.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight < 150 ? this.scrollHeight : 150) + 'px';
        });

        // Handle Enter key (Shift+Enter for new line)
        aiPrompt.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                btnGenerateAI.click();
            }
        });

        function appendMessage(role, content, isHTML = false, rawText = '') {
            const messageDiv = document.createElement('div');
            messageDiv.className = `chat-message ${role}-message`;
            
            const bubble = document.createElement('div');
            bubble.className = 'message-bubble';
            
            if (role === 'ai' && isHTML && !content.includes('typing-indicator')) {
                // Add Copy Button header for actual AI responses
                const headerDiv = document.createElement('div');
                headerDiv.className = 'ai-message-header';
                
                const copyBtn = document.createElement('button');
                copyBtn.className = 'btn-copy';
                copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy`;
                
                copyBtn.onclick = () => {
                    navigator.clipboard.writeText(rawText || bubbleContent.innerText).then(() => {
                        copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`;
                        setTimeout(() => {
                            copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy`;
                        }, 2000);
                    });
                };
                
                headerDiv.appendChild(copyBtn);
                bubble.appendChild(headerDiv);
                
                const bubbleContent = document.createElement('div');
                bubbleContent.className = 'formatted-assignment';
                bubbleContent.innerHTML = content;
                bubble.appendChild(bubbleContent);
            } else {
                if (isHTML) {
                    bubble.innerHTML = content;
                } else {
                    bubble.textContent = content;
                }
            }
            
            messageDiv.appendChild(bubble);
            chatContainer.appendChild(messageDiv);
            
            // Scroll to bottom
            chatContainer.scrollTop = chatContainer.scrollHeight;
            
            return messageDiv;
        }

        function getLoadingHTML() {
            return `
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            `;
        }

        btnGenerateAI.addEventListener('click', async () => {
            const question = aiPrompt.value.trim();
            if (!question) return;

            // 1. Add user message
            appendMessage('user', question);
            
            // Clear input and reset height
            aiPrompt.value = '';
            aiPrompt.style.height = 'auto';
            
            // Disable input while generating
            btnGenerateAI.disabled = true;
            aiPrompt.disabled = true;

            // 2. Add loading message
            const loadingMessage = appendMessage('ai', getLoadingHTML(), true);

            try {
                // NOTE: Replace this with your actual OpenAI API Key if you want real responses
                const apiKey = ''; 
                let answer = "";

                if (apiKey) {
                    const response = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: "gpt-3.5-turbo",
                            messages: [
                                { 
                                    role: "system", 
                                    content: "Generate a well-structured academic answer suitable for assignment writing. Include:\n- Clear title\n- Short introduction\n- 3-5 main points with headings\n- Simple explanation\n- Conclusion\nKeep language easy and human-like." 
                                },
                                { role: "user", content: question }
                            ],
                            temperature: 0.7
                        })
                    });
                    
                    if (!response.ok) throw new Error("API request failed");
                    
                    const data = await response.json();
                    answer = data.choices[0].message.content;
                } else {
                    // Placeholder simulation (wait 1.5 seconds)
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    answer = `# Understanding: ${question}\n\nWelcome to your AI-generated assignment guide. This response is structured to help you easily understand and copy the necessary information for your coursework.\n\n## Introduction\nThis topic covers the fundamental aspects of the question you asked. It is important to grasp these core concepts before moving on to the more complex applications.\n\n## Main Points\nHere is a breakdown of the key elements you need to include in your assignment:\n\n* **First Core Concept**: Start by defining the basic terms and their relevance to the topic.\n* **Second Major Point**: Provide examples or evidence to support your arguments.\n* **Third Supporting Detail**: Discuss any opposing views or alternative methods.\n\n### Additional Considerations\n1. Always check your sources.\n2. Ensure your arguments flow logically.\n\n## Conclusion\nIn summary, by following these structured points, you can build a comprehensive and well-rounded assignment. Remember to review and refine your work before submission.\n\n*Note: To get real AI answers, provide an OpenAI API key in script.js (line ~835).*`;
                }

                // Simple markdown-like formatting parser for the UI
                let htmlAnswer = answer
                    // Headers
                    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                    // Bold
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    // Lists (simple conversion for * or - at start of line)
                    .replace(/^\* (.*$)/gim, '<ul><li>$1</li></ul>')
                    .replace(/^- (.*$)/gim, '<ul><li>$1</li></ul>')
                    // Numbered lists (simple conversion for 1. 2. etc at start of line)
                    .replace(/^\d+\.\s(.*$)/gim, '<ol><li>$1</li></ol>')
                    // Fix adjacent lists
                    .replace(/<\/ul>\n<ul>/g, '\n')
                    .replace(/<\/ol>\n<ol>/g, '\n')
                    // Paragraphs (double line breaks)
                    .replace(/\n\n/g, '</p><p>')
                    // Single line breaks
                    .replace(/\n/g, '<br>');
                
                // Wrap in paragraph if it doesn't start with a block element
                if (!htmlAnswer.startsWith('<h') && !htmlAnswer.startsWith('<ul') && !htmlAnswer.startsWith('<ol')) {
                    htmlAnswer = '<p>' + htmlAnswer + '</p>';
                }

                // Remove loading message and append actual response (pass raw answer for the copy button)
                loadingMessage.remove();
                appendMessage('ai', htmlAnswer, true, answer);

            } catch (error) {
                console.error(error);
                loadingMessage.remove();
                appendMessage('ai', `<span style="color: #ef4444;">Error generating response. Please check your API key or connection.</span>`, true);
            } finally {
                btnGenerateAI.disabled = false;
                aiPrompt.disabled = false;
                aiPrompt.focus();
            }
        });
    }

    // --- Email Notifications Feature (Time-based Reminder) ---
    function initEmailNotifications() {
        const timeInput = document.getElementById('reminder-time-input');
        const emailToggle = document.getElementById('email-notif-toggle');
        
        if (timeInput && emailToggle) {
            timeInput.value = emailPrefs.reminderTime || '19:00';
            emailToggle.checked = emailPrefs.enabled;
            
            // Handle Toggle Change
            emailToggle.addEventListener('change', (e) => {
                const isEnabled = e.target.checked;
                const timeVal = timeInput.value;
                
                if (isEnabled && !timeVal) {
                    alert("Please set a reminder time first.");
                    e.target.checked = false;
                    return;
                }
                
                emailPrefs.enabled = isEnabled;
                emailPrefs.reminderTime = timeVal;
                saveUserData('emailPrefs', emailPrefs);
                
                if (isEnabled) {
                    showEmailStatus(`Reminder set for ${formatTime(timeVal)}.`);
                    checkOverdueNotifications(); // Check immediately when turned on
                } else {
                    showEmailStatus("Daily reminder disabled.");
                }
            });

            // Handle Time Change
            timeInput.addEventListener('change', (e) => {
                const timeVal = e.target.value;
                if (!timeVal) return;
                
                emailPrefs.reminderTime = timeVal;
                // If they change the time, reset the 'sent today' flag so they can get another email at the new time today
                emailPrefs.lastReminderSent = null; 
                saveUserData('emailPrefs', emailPrefs);
                
                if (emailPrefs.enabled) {
                    showEmailStatus(`Reminder updated to ${formatTime(timeVal)}.`);
                }
            });
        }

        // Start background interval to check time every 1 minute
        setInterval(checkOverdueNotifications, 60000);
    }
    
    // Helper to format 24h to 12h AM/PM
    function formatTime(time24) {
        const [hourStr, min] = time24.split(':');
        let hour = parseInt(hourStr, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12 || 12;
        return `${hour}:${min} ${ampm}`;
    }
    
    function showEmailStatus(msg) {
        const emailStatus = document.getElementById('email-status-msg');
        if (!emailStatus) return;
        emailStatus.textContent = msg;
        emailStatus.style.display = 'block';
        setTimeout(() => { emailStatus.style.display = 'none'; }, 4000);
    }
    
    async function sendEmailJS(toEmail, messageText) {
        try {
            // Note: These are placeholders. You will need to replace them with your actual EmailJS credentials.
            // 1. Create a free account at emailjs.com
            // 2. Add an email service (e.g., Gmail)
            // 3. Create an email template with {{message}} variable
            // 4. Get your Public Key from Account -> API Keys
            const PUBLIC_KEY = "YOUR_PUBLIC_KEY"; 
            const SERVICE_ID = "YOUR_SERVICE_ID";
            const TEMPLATE_ID = "YOUR_TEMPLATE_ID";
            
            if (PUBLIC_KEY === "YOUR_PUBLIC_KEY") {
                console.log("EmailJS is not configured. The following email would be sent to", toEmail, ":", messageText);
                return; // Remove this return once configured to actually send
            }
            
            emailjs.init(PUBLIC_KEY);
            
            await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
                to_email: toEmail,
                message: messageText
            });
            console.log("Email sent successfully to", toEmail);
        } catch (error) {
            console.error("EmailJS Error:", error);
        }
    }
    
    window.checkOverdueNotifications = function() {
        if (!emailPrefs || !emailPrefs.enabled || !currentUser || !currentUser.email) return;
        
        const now = new Date();
        const todayStr = now.toDateString();
        
        // 1. Check if already sent today
        if (emailPrefs.lastReminderSent === todayStr) return;
        
        // 2. Check if it is past the reminder time
        const [targetHour, targetMin] = emailPrefs.reminderTime.split(':').map(Number);
        const currentHour = now.getHours();
        const currentMin = now.getMinutes();
        
        // Only send if current time is exactly or past the target time today
        if (currentHour < targetHour || (currentHour === targetHour && currentMin < targetMin)) {
            return; // Not time yet
        }
        
        // 3. Prepare Email Content
        today.setHours(0, 0, 0, 0);
        
        const overdueTasks = tasks.filter(t => {
            const deadlineDate = new Date(t.deadline);
            deadlineDate.setHours(0, 0, 0, 0);
            return !t.completed && deadlineDate < today;
        });

        const pendingToday = tasks.filter(t => !t.completed).length;
        
        // If frequency is "overdue_only" and there are no overdue tasks, do not send email
        if (emailPrefs.frequency === 'overdue_only' && overdueTasks.length === 0) {
            return;
        }

        let message = `Reminder: Please complete your tasks for today. You have ${pendingToday} pending tasks overall.`;
        
        if (overdueTasks.length > 0) {
            message += `\n\n⚠️ IMPORTANT: You have ${overdueTasks.length} overdue task(s)! Please log in to your Smart Study Planner and complete them soon!`;
        }
        
        // 4. Send Email (using saved email, fallback to currentUser.email)
        const targetEmail = emailPrefs.email || currentUser.email;
        sendEmailJS(targetEmail, message);
        
        // 5. Update state
        emailPrefs.lastReminderSent = todayStr;
        saveUserData('emailPrefs', emailPrefs);
    }
    
    // --- Email Settings / Onboarding Modal ---
    function openSettingsModal() {
        const modal = document.getElementById('email-setup-modal');
        const emailInput = document.getElementById('onboarding-email');
        const timeInput = document.getElementById('onboarding-time');
        const toggleInput = document.getElementById('onboarding-toggle');
        const freqInput = document.getElementById('onboarding-frequency');
        const skipContainer = document.getElementById('skip-setup-container');
        const closeBtn = document.getElementById('close-settings-btn');
        
        if (!modal) return;
        
        // Load existing data from localStorage using explicit keys
        const savedEmail = localStorage.getItem('userEmail');
        const savedTime = localStorage.getItem('reminderTime');
        const savedEnabled = localStorage.getItem('notificationsEnabled');
        
        if (emailInput) {
            emailInput.value = savedEmail || '';
            emailInput.disabled = false;
        }
        if (timeInput) {
            timeInput.value = savedTime || '';
        }
        if (toggleInput) {
            toggleInput.checked = savedEnabled === 'true';
        }
        if (freqInput) {
            freqInput.value = emailPrefs.frequency || 'daily';
        }
        
        // Hide skip button and show close button if setup is already done
        if (emailPrefs.setupDone) {
            if (skipContainer) skipContainer.style.display = 'none';
            if (closeBtn) closeBtn.style.display = 'block';
        } else {
            if (skipContainer) skipContainer.style.display = 'block';
            if (closeBtn) closeBtn.style.display = 'none';
        }
        
        modal.classList.remove('closing');
        modal.style.display = 'flex';
        document.body.classList.add('modal-open');
    }

    function closeModal() {
        const modal = document.getElementById('email-setup-modal');
        if (!modal) return;
        
        modal.classList.add('closing');
        
        // Wait for animation to finish before hiding and removing class
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('closing');
            document.body.classList.remove('modal-open');
        }, 300); // Matches the 0.3s CSS animation duration
    }

    function checkEmailOnboarding() {
        if (!emailPrefs || emailPrefs.setupDone === true) return;
        openSettingsModal();
    }
    
    // Attach event listeners for modal buttons once
    const saveBtn = document.getElementById('btn-save-email-setup');
    const skipBtn = document.getElementById('btn-skip-email-setup');
    const closeBtn = document.getElementById('close-settings-btn');
    const modal = document.getElementById('email-setup-modal');
    
    // Close when clicking outside the modal content
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal && emailPrefs.setupDone) {
                closeModal();
            }
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (emailPrefs.setupDone) {
                closeModal();
            }
        });
    }
    
    if (saveBtn) {
        saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Save clicked');
            
            const emailInput = document.getElementById('onboarding-email');
            const timeInput = document.getElementById('onboarding-time');
            const toggleInput = document.getElementById('onboarding-toggle');
            const freqInput = document.getElementById('onboarding-frequency');
            const statusMsg = document.getElementById('email-status-msg');
            
            const timeVal = timeInput ? timeInput.value : '19:00';
            const isEnabled = toggleInput ? toggleInput.checked : false;
            const emailVal = emailInput ? emailInput.value.trim() : '';
            const freqVal = freqInput ? freqInput.value : 'daily';
            
            console.log('Captured values:', {
                email: emailVal,
                time: timeVal,
                enabled: isEnabled,
                frequency: freqVal
            });
            
            // Clear previous message
            if (statusMsg) {
                statusMsg.style.display = 'none';
                statusMsg.textContent = '';
            }
            
            // Validation
            if (isEnabled) {
                if (!emailVal) {
                    if (statusMsg) {
                        statusMsg.style.display = 'block';
                        statusMsg.style.color = '#ef4444'; // Red color for error
                        statusMsg.textContent = 'Please enter a valid email address.';
                    } else {
                        alert("Please enter a valid email address.");
                    }
                    return;
                }
                if (!timeVal) {
                    if (statusMsg) {
                        statusMsg.style.display = 'block';
                        statusMsg.style.color = '#ef4444'; // Red color for error
                        statusMsg.textContent = 'Please select a notification time.';
                    } else {
                        alert("Please select a notification time.");
                    }
                    return;
                }
            }
            
            // If time or frequency changed, reset lastReminderSent so they can get a new email today if applicable
            if (emailPrefs.reminderTime !== timeVal || emailPrefs.frequency !== freqVal) {
                emailPrefs.lastReminderSent = null;
            }

            emailPrefs.setupDone = true;
            emailPrefs.enabled = isEnabled;
            emailPrefs.reminderTime = timeVal;
            emailPrefs.email = emailVal || (currentUser ? currentUser.email : '');
            emailPrefs.frequency = freqVal;
            
            saveUserData('emailPrefs', emailPrefs);
            
            // Store directly in localStorage with clear keys as requested
            localStorage.setItem('userEmail', emailVal || (currentUser ? currentUser.email : ''));
            localStorage.setItem('reminderTime', timeVal);
            localStorage.setItem('notificationsEnabled', isEnabled.toString());
            
            console.log('Saved to localStorage');
            
            // Show success message briefly before closing
            if (statusMsg) {
                statusMsg.style.display = 'block';
                statusMsg.style.color = 'var(--primary-color)'; // Green color for success
                statusMsg.textContent = 'Settings saved successfully!';
                
                setTimeout(() => {
                    closeModal();
                    statusMsg.style.display = 'none';
                }, 1500); // Close after 1.5 seconds
            } else {
                closeModal();
            }
            
            if (isEnabled) {
                showEmailStatus(`Settings saved. Reminder set for ${formatTime(emailPrefs.reminderTime)}.`);
                checkOverdueNotifications(); // Immediate check
            } else {
                showEmailStatus("Email notifications disabled.");
            }
        });
    }
    
    if (skipBtn) {
        skipBtn.addEventListener('click', () => {
            emailPrefs.setupDone = true;
            emailPrefs.enabled = false;
            saveUserData('emailPrefs', emailPrefs);
            closeModal();
        });
    }

});