import { useState, useEffect } from 'react';

function getRevisionDates(examDateISO, difficulty, memoryStrength, startDateISO = null, options = {}) {
  const { targetRetention = 0.6, postReviewBoost = 1.8, baseStrengthDays = 4, maxIterations = 200 } = options;
  const difficultyScale = { easy: 1.3, medium: 1.0, hard: 0.7 };
  const exam = new Date(examDateISO);
  exam.setHours(0, 0, 0, 0);
  const lastDay = new Date(exam);
  lastDay.setDate(exam.getDate() - 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = startDateISO ? new Date(startDateISO) : today;
  start.setHours(0, 0, 0, 0);
  if (start > lastDay) return { error: 'Start date must be on or before the day before the exam.' };
  let S = Math.max(0.1, Number(memoryStrength)) * baseStrengthDays * (difficultyScale[difficulty] || 1);
  const dates = [];
  let current = new Date(start);
  dates.push(new Date(current));
  let iter = 0;
  while (true) {
    iter += 1;
    if (iter > maxIterations) break;
    const t = Math.max(1, Math.ceil(-S * Math.log(targetRetention)));
    const candidate = new Date(current);
    candidate.setDate(current.getDate() + t);
    if (candidate > lastDay) {
      if (dates[dates.length - 1].toDateString() !== lastDay.toDateString()) dates.push(new Date(lastDay));
      break;
    }
    dates.push(new Date(candidate));
    S = S * postReviewBoost;
    current = candidate;
  }
  const unique = Array.from(new Set(dates.map(d => d.toDateString()))).map(s => new Date(s));
  unique.sort((a, b) => a - b);
  if (unique.length === 1 && unique[0].toDateString() !== lastDay.toDateString()) unique.push(new Date(lastDay));
  return { dates: unique };
}

function formatDate(d) {
  if (!d) return '';
  return d.toDateString();
}

function dateStringToISO(dateStr) {
  // Convert "Wed Nov 13 2025" to "2025-11-13"
  const dateParts = dateStr.split(' ');
  const monthStr = dateParts[1];
  const dayStr = dateParts[2];
  const yearStr = dateParts[3];
  
  const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
  const month = months[monthStr];
  const day = String(dayStr).padStart(2, '0');
  return `${yearStr}-${month}-${day}`;
}

export default function ProductivityScheduler({ clientId }) {
  const [examDate, setExamDate] = useState('');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [memoryStrength, setMemoryStrength] = useState(3);

  function localISODateString(date = new Date()) {
    const d = new Date(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  const [startDate, setStartDate] = useState(() => localISODateString());
  const [schedule, setSchedule] = useState([]);
  const [info, setInfo] = useState('');
  const [sessionDensity, setSessionDensity] = useState(0.6);
  const [savedSchedules, setSavedSchedules] = useState(() => {
    try {
      const raw = localStorage.getItem('savedSchedules');
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.warn('Failed to read savedSchedules', err);
      return [];
    }
  });
  const [expanded, setExpanded] = useState({});
  const [completedMap, setCompletedMap] = useState({});
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [googleAccessToken, setGoogleAccessToken] = useState(() => localStorage.getItem('googleAccessToken') || null);
  const [syncingScheduleId, setSyncingScheduleId] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem('savedSchedules', JSON.stringify(savedSchedules));
    } catch (err) {
      console.warn('Failed to write savedSchedules', err);
    }
  }, [savedSchedules]);

  function toggleCompleted(dateStr, sourceId = null) {
    setCompletedMap(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
    if (sourceId) {
      setSavedSchedules(prev =>
        prev.map(s =>
          s.id === sourceId
            ? {
                ...s,
                completed: { ...(s.completed || {}), [dateStr]: !((s.completed || {})[dateStr]) }
              }
            : s
        )
      );
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!examDate || !subject || !topic) return;
    const res = getRevisionDates(examDate, difficulty, Number(memoryStrength), startDate);
    if (res.error) {
      setInfo(res.error);
      setSchedule([]);
      return;
    }
    const dates = res.dates;
    setSchedule(dates);
    const cm = {};
    dates.forEach(d => (cm[new Date(d).toDateString()] = false));
    setCompletedMap(cm);
    setInfo(
      `Computed ${dates.length} revisions (first = ${formatDate(dates[0])}, last = ${formatDate(dates[dates.length - 1])})`
    );
  }

  function handleModify() {
    const res = getRevisionDates(examDate, difficulty, Number(memoryStrength), startDate, {
      targetRetention: sessionDensity
    });
    if (res.error) {
      setInfo(res.error);
      return;
    }
    const dates = res.dates;
    setSchedule(dates);
    const cm = {};
    dates.forEach(d => (cm[new Date(d).toDateString()] = false));
    setCompletedMap(cm);
    setInfo(
      `Modified: ${dates.length} revisions (density=${sessionDensity.toFixed(2)}, first=${formatDate(dates[0])}, last=${formatDate(dates[dates.length - 1])})`
    );
  }

  function handleConfirm() {
    if (schedule.length === 0) return;
    const scheduleId = `${subject}_${topic}_${Date.now()}`;
    const newSchedule = {
      id: scheduleId,
      subject,
      topic,
      examDate,
      startDate,
      difficulty,
      memoryStrength,
      dates: schedule.map(d => formatDate(d)),
      completed: completedMap
    };
    setSavedSchedules(prev => [...prev, newSchedule]);
    setSchedule([]);
    setCompletedMap({});
    setExamDate('');
    setSubject('');
    setTopic('');
    setDifficulty('medium');
    setMemoryStrength(3);
    setStartDate(localISODateString());
    setInfo('Schedule saved!');
  }

  function handleCancel() {
    setSchedule([]);
    setCompletedMap({});
    setInfo('');
  }

  function handleEditSchedule(scheduleToEdit) {
    setExamDate(scheduleToEdit.examDate);
    setSubject(scheduleToEdit.subject);
    setTopic(scheduleToEdit.topic);
    setDifficulty(scheduleToEdit.difficulty);
    setMemoryStrength(scheduleToEdit.memoryStrength);
    setStartDate(scheduleToEdit.startDate);
    setEditingScheduleId(scheduleToEdit.id);
    setInfo('');
    setSchedule([]);
    setCompletedMap({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleDeleteSchedule(scheduleId) {
    setSavedSchedules(prev => prev.filter(s => s.id !== scheduleId));
  }

  function handleConfirmEdit() {
    if (schedule.length === 0) return;
    setSavedSchedules(prev =>
      prev.map(s =>
        s.id === editingScheduleId
          ? {
              ...s,
              examDate,
              startDate,
              difficulty,
              memoryStrength,
              dates: schedule.map(d => formatDate(d)),
              completed: completedMap
            }
          : s
      )
    );
    setSchedule([]);
    setCompletedMap({});
    setExamDate('');
    setSubject('');
    setTopic('');
    setDifficulty('medium');
    setMemoryStrength(3);
    setStartDate(localISODateString());
    setEditingScheduleId(null);
    setInfo('Schedule updated!');
  }

  useEffect(() => {
    // Check for OAuth redirect with access token
    const hash = window.location.hash;
    if (hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      if (accessToken) {
        setGoogleAccessToken(accessToken);
        localStorage.setItem('googleAccessToken', accessToken);
        setInfo('✓ Connected to Google Calendar');
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const signInWithGoogle = () => {
    const scope = 'https://www.googleapis.com/auth/calendar';
    const redirectUri = window.location.origin;
    const responseType = 'token';
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=${responseType}&` +
      `scope=${encodeURIComponent(scope)}`;
    
    window.location.href = authUrl;
  };

  const _syncScheduleToGoogleCalendar = async (schedule) => {
    if (!googleAccessToken) {
      signInWithGoogle();
      return;
    }

    setSyncingScheduleId(schedule.id);
    try {
      const calendarTitle = `${schedule.subject} - ${schedule.topic}`;
      const events = schedule.dates.map((dateStr) => {
        const isoDate = dateStringToISO(dateStr);
        return {
          summary: `📖 Revise: ${calendarTitle}`,
          description: `Review ${schedule.topic} for ${schedule.subject} exam (Difficulty: ${schedule.difficulty})`,
          start: {
            date: isoDate
          },
          end: {
            date: isoDate
          },
          colorId: '1'
        };
      });

      for (const event of events) {
        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(event)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Failed to create calendar event: ${errorData.error?.message || response.statusText}`);
        }
      }

      setSyncingScheduleId(null);
      setInfo(`✓ Synced ${events.length} revision dates to Google Calendar!`);
    } catch (err) {
      console.error('Sync failed:', err);
      setInfo(`Failed to sync: ${err.message}`);
      setSyncingScheduleId(null);
    }
  };

  const subjectGroups = Object.entries(
    savedSchedules.reduce((acc, s) => {
      if (!acc[s.subject]) acc[s.subject] = [];
      acc[s.subject].push(s);
      return acc;
    }, {})
  );

  const toggleExpand = (key) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div style={{ padding: '1.5rem', fontFamily: 'Arial, sans-serif', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>📚 Productivity Scheduler</h1>

      <div
        style={{
          border: '1px solid #ccc',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '2rem',
          backgroundColor: '#f9f9f9'
        }}
      >
        <h2>{editingScheduleId ? '✏️ Edit Schedule' : 'Generate Revision Schedule'}</h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label htmlFor="subject" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold' }}>Subject:</label>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g., Math"
              disabled={editingScheduleId !== null}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: editingScheduleId ? '#f0f0f0' : '#fff', cursor: editingScheduleId ? 'not-allowed' : 'text' }}
            />
          </div>

          <div>
            <label htmlFor="topic" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold' }}>Topic:</label>
            <input
              id="topic"
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g., Calculus"
              disabled={editingScheduleId !== null}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: editingScheduleId ? '#f0f0f0' : '#fff', cursor: editingScheduleId ? 'not-allowed' : 'text' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label htmlFor="startDate" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold' }}>Start Date:</label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>
            <div>
              <label htmlFor="examDate" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold' }}>Exam Date:</label>
              <input
                id="examDate"
                type="date"
                value={examDate}
                onChange={e => setExamDate(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label htmlFor="difficulty" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold' }}>Difficulty:</label>
              <select
                id="difficulty"
                value={difficulty}
                onChange={e => setDifficulty(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label htmlFor="memoryStrength" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold' }}>Memory Strength (days):</label>
              <input
                id="memoryStrength"
                type="number"
                min="0.5"
                step="0.5"
                value={memoryStrength}
                onChange={e => setMemoryStrength(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>
          </div>

          <button
            type="submit"
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: editingScheduleId ? '#ff9800' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold',
              width: '100%'
            }}
          >
            {editingScheduleId ? 'Regenerate Schedule' : 'Generate Schedule'}
          </button>
        </form>

        {editingScheduleId && (
          <button
            onClick={() => {
              setEditingScheduleId(null);
              setSchedule([]);
              setCompletedMap({});
              setExamDate('');
              setSubject('');
              setTopic('');
              setDifficulty('medium');
              setMemoryStrength(3);
              setStartDate(localISODateString());
              setInfo('');
            }}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold',
              width: '100%',
              marginTop: '0.5rem'
            }}
          >
            Cancel Edit
          </button>
        )}

        {info && (
          <div
            style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: '#e7f3ff',
              border: '1px solid #b3d9ff',
              borderRadius: '4px',
              color: '#004085',
              textAlign: 'center'
            }}
          >
            {info}
          </div>
        )}
      </div>

      {schedule.length > 0 && (
        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '1.5rem',
            marginBottom: '2rem',
            backgroundColor: '#fff8f0',
            maxWidth: '900px',
            margin: '0 auto 2rem'
          }}
        >
          <h3 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Revision Schedule Preview for {subject} — {topic}:</h3>
          <div style={{ marginBottom: '1.5rem', backgroundColor: '#fff', padding: '1rem', borderRadius: '4px', maxHeight: '300px', overflowY: 'auto' }}>
            {schedule.map((date, idx) => {
              const dateStr = formatDate(date);
              const isChecked = completedMap[dateStr];
              return (
                <div key={idx} style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleCompleted(dateStr)}
                    id={`preview-${idx}`}
                  />
                  <label
                    htmlFor={`preview-${idx}`}
                    style={{
                      textDecoration: isChecked ? 'line-through' : 'none',
                      color: isChecked ? '#999' : '#000',
                      flex: 1
                    }}
                  >
                    {dateStr}
                  </label>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '1.5rem', padding: '0 0.5rem' }}>
            <label htmlFor="sessionDensity" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Session Density: {sessionDensity.toFixed(2)}</label>
            <input
              id="sessionDensity"
              type="range"
              min="0.3"
              max="0.9"
              step="0.05"
              value={sessionDensity}
              onChange={e => setSessionDensity(parseFloat(e.target.value))}
              style={{ width: '100%', marginTop: '0.5rem' }}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.75rem',
              marginTop: '1.5rem'
            }}
          >
            <button
              onClick={handleModify}
              style={{
                padding: '0.75rem',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Modify
            </button>
            <button
              onClick={editingScheduleId ? handleConfirmEdit : handleConfirm}
              style={{
                padding: '0.75rem',
                backgroundColor: editingScheduleId ? '#ff9800' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {editingScheduleId ? 'Update' : 'Confirm'}
            </button>
            <button
              onClick={handleCancel}
              style={{
                padding: '0.75rem',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {savedSchedules.length > 0 && (
        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '1.5rem',
            backgroundColor: '#f0f0f0',
            maxWidth: '900px',
            margin: '0 auto'
          }}
        >
          <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Saved Subjects</h2>
          {subjectGroups.map(([subjectName, topicItems]) => (
            <div key={subjectName} style={{ marginBottom: '1rem' }}>
              <div
                onClick={() => toggleExpand(subjectName)}
                style={{
                  cursor: 'pointer',
                  padding: '0.75rem',
                  backgroundColor: '#e9ecef',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>{subjectName}</span>
                <span>{expanded[subjectName] ? '▼' : '▶'}</span>
              </div>

              {expanded[subjectName] && (
                <div style={{ marginLeft: '0.5rem', marginTop: '0.5rem', paddingLeft: '0.5rem', borderLeft: '3px solid #ccc' }}>
                  {topicItems.map(schedule => (
                    <div key={schedule.id} style={{ marginBottom: '1rem' }}>
                      <div
                        onClick={() => toggleExpand(schedule.id)}
                        style={{
                          cursor: 'pointer',
                          padding: '0.5rem',
                          backgroundColor: '#fff3cd',
                          border: '1px solid #ffc107',
                          borderRadius: '4px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <strong>{schedule.topic}</strong>
                          <div style={{ fontSize: '0.9rem', color: '#666' }}>
                            Exam: {schedule.examDate} | Difficulty: {schedule.difficulty}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditSchedule(schedule);
                            }}
                            style={{
                              padding: '0.35rem 0.75rem',
                              backgroundColor: '#ff9800',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              fontWeight: 'bold'
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              _syncScheduleToGoogleCalendar(schedule);
                            }}
                            disabled={syncingScheduleId === schedule.id}
                            style={{
                              padding: '0.35rem 0.75rem',
                              backgroundColor: '#4285f4',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: syncingScheduleId === schedule.id ? 'wait' : 'pointer',
                              fontSize: '0.9rem',
                              fontWeight: 'bold',
                              opacity: syncingScheduleId === schedule.id ? 0.7 : 1
                            }}
                          >
                            {syncingScheduleId === schedule.id ? 'Syncing...' : 'Sync Cal'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete "${schedule.topic}"?`)) {
                                handleDeleteSchedule(schedule.id);
                              }
                            }}
                            style={{
                              padding: '0.35rem 0.75rem',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              fontWeight: 'bold'
                            }}
                          >
                            Delete
                          </button>
                          <span>{expanded[schedule.id] ? '▼' : '▶'}</span>
                        </div>
                      </div>

                      {expanded[schedule.id] && (
                        <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem', listStyle: 'none', backgroundColor: '#fff', padding: '0.75rem', borderRadius: '4px' }}>
                          {schedule.dates.map((dateStr, idx) => {
                            const isCompleted = schedule.completed && schedule.completed[dateStr];
                            return (
                              <li
                                key={idx}
                                style={{
                                  marginBottom: '0.25rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isCompleted || false}
                                  onChange={() => toggleCompleted(dateStr, schedule.id)}
                                  id={`saved-${schedule.id}-${idx}`}
                                />
                                <label
                                  htmlFor={`saved-${schedule.id}-${idx}`}
                                  style={{
                                    textDecoration: isCompleted ? 'line-through' : 'none',
                                    color: isCompleted ? '#999' : '#000'
                                  }}
                                >
                                  {dateStr}
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
