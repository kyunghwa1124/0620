import { useMemo, useRef, useState } from 'react'

const lessons = [
  { id: 'spring', level: '1학년', title: '봄이 왔어요', text: '봄이 왔어요.' },
  { id: 'kind', level: '2학년', title: '마음 전하기', text: '고마운 마음을 전해요.' },
  { id: 'book', level: '3학년', title: '책 읽는 시간', text: '나는 책 읽기를 좋아해요.' },
]

const palette = { match: 'good', mismatch: 'wrong', uncertain: 'uncertain' }

function demoResult(expectedText) {
  const characters = [...expectedText].map((char, index) => {
    if (char === ' ') return { expected: char, recognized: char, status: 'match', confidence: 'high' }
    if (index === 2) return { expected: char, recognized: '?', status: 'uncertain', confidence: 'low' }
    if (index === 6) return { expected: char, recognized: char === '요' ? '오' : char, status: 'mismatch', confidence: 'medium' }
    return { expected: char, recognized: char, status: 'match', confidence: 'high' }
  })
  return {
    recognizedText: characters.map((item) => item.recognized).join(''),
    overallConfidence: 'medium',
    characters,
    feedback: '글자마다 천천히 또박또박 써 보았어요! 글자 사이를 조금만 더 띄워 보면 더 잘 읽힐 거예요.',
    demo: true,
  }
}

function readStorage() {
  try { return JSON.parse(localStorage.getItem('write-buddy-submissions') || '[]') } catch { return [] }
}

function scoreOf(result) {
  const visible = result.characters.filter((item) => item.expected.trim())
  if (!visible.length) return 0
  return Math.round((visible.filter((item) => item.status === 'match').length / visible.length) * 100)
}

function App() {
  const [view, setView] = useState('practice')
  const [studentName, setStudentName] = useState('김하늘')
  const [lessonId, setLessonId] = useState(lessons[0].id)
  const [image, setImage] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [submissions, setSubmissions] = useState(readStorage)
  const [memo, setMemo] = useState('')
  const cameraRef = useRef(null)
  const uploadRef = useRef(null)
  const lesson = lessons.find((item) => item.id === lessonId)

  const stats = useMemo(() => {
    const scores = submissions.map((item) => item.score)
    return {
      count: submissions.length,
      average: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0,
      latest: submissions[0],
    }
  }, [submissions])

  function loadFile(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setNotice('사진 파일을 골라 주세요.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setImage({ dataUrl: reader.result, mimeType: file.type })
      setResult(null)
      setNotice('사진을 준비했어요. 판독하기를 눌러 볼까요?')
    }
    reader.readAsDataURL(file)
  }

  async function analyze() {
    if (!image) { setNotice('먼저 손글씨 사진을 찍어 주세요.'); return }
    setLoading(true)
    setNotice('글씨를 천천히 읽고 있어요…')
    const imageBase64 = image.dataUrl.split(',')[1]
    try {
      const response = await fetch('/.netlify/functions/analyze-handwriting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType: image.mimeType, expectedText: lesson.text }),
      })
      if (!response.ok) throw new Error('analysis unavailable')
      const next = await response.json()
      setResult(next)
      setNotice('판독이 끝났어요. 색깔을 눌러 결과를 확인해 보세요!')
    } catch {
      const next = demoResult(lesson.text)
      setResult(next)
      setNotice('데모 판독 결과를 보여 드려요. 배포 후 API 키를 설정하면 AI 판독으로 바뀝니다.')
    } finally { setLoading(false) }
  }

  function saveSubmission() {
    if (!result) return
    const entry = {
      id: crypto.randomUUID(),
      studentName: studentName.trim() || '이름 없음',
      lessonTitle: lesson.title,
      expectedText: lesson.text,
      date: new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }),
      score: scoreOf(result),
      result,
      memo,
    }
    const next = [entry, ...submissions]
    localStorage.setItem('write-buddy-submissions', JSON.stringify(next))
    setSubmissions(next)
    setMemo('')
    setNotice('내 기록장에 저장했어요. 정말 잘했어요!')
  }

  function resetPractice() {
    setImage(null); setResult(null); setNotice(''); setMemo('')
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView('practice')} aria-label="또박또박 홈">
          <span className="brand-mark">또</span><span>또박또박</span>
        </button>
        <nav>
          <button className={view === 'practice' ? 'active' : ''} onClick={() => setView('practice')}>손글씨 연습</button>
          <button className={view === 'teacher' ? 'active' : ''} onClick={() => setView('teacher')}>선생님 공간</button>
        </nav>
        <div className="avatar" aria-label="학생 프로필">하</div>
      </header>

      {view === 'practice' ? (
        <section className="content practice-layout">
          <div className="welcome-row">
            <div><p className="eyebrow">오늘의 또박또박 연습</p><h1>안녕, {studentName || '친구'}!<br />오늘도 한 글자씩 해 볼까?</h1></div>
            <div className="streak-card"><span>✨</span><div><b>이번 주 3일째</b><small>꾸준히 쓰고 있어요</small></div></div>
          </div>

          <div className="practice-grid">
            <section className="card lesson-card">
              <div className="section-label"><span>1</span> 따라 쓸 문장을 골라요</div>
              <div className="lesson-picker">
                {lessons.map((item) => <button key={item.id} className={item.id === lessonId ? 'selected' : ''} onClick={() => { setLessonId(item.id); resetPractice() }}><small>{item.level}</small>{item.title}</button>)}
              </div>
              <div className="copy-paper"><span className="paper-pin">✦</span><p>{lesson.text}</p><small>천천히, 글자 사이를 살짝 띄워서 써 보세요.</small></div>
              <label className="name-field">이름 <input value={studentName} maxLength="12" onChange={(event) => setStudentName(event.target.value)} /></label>
            </section>

            <section className="card capture-card">
              <div className="section-label"><span>2</span> 쓴 글씨를 찍어요</div>
              {image ? <img className="preview" src={image.dataUrl} alt="업로드한 손글씨" /> : <div className="camera-empty"><div className="camera-icon">▣</div><b>손글씨가 화면에 쏙!</b><span>밝은 곳에서 종이를 평평하게 놓아 주세요.</span></div>}
              <div className="photo-actions">
                <button className="secondary" onClick={() => cameraRef.current?.click()}>카메라로 찍기</button>
                <button className="secondary" onClick={() => uploadRef.current?.click()}>사진 고르기</button>
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => loadFile(event.target.files?.[0])} />
                <input ref={uploadRef} type="file" accept="image/*" hidden onChange={(event) => loadFile(event.target.files?.[0])} />
              </div>
              <div className="tip"><span>💡</span><span>글씨가 흐리거나 그림자가 지면 다시 찍어 주세요.</span></div>
            </section>
          </div>

          <section className="analyze-bar card">
            <div>{notice ? <span className="notice">{notice}</span> : <span>사진을 찍고 <b>판독하기</b>를 눌러 보세요.</span>}</div>
            <button className="primary" disabled={loading || !image} onClick={analyze}>{loading ? '읽는 중이에요…' : 'AI가 글씨 판독하기 →'}</button>
          </section>

          {result && <ResultPanel result={result} image={image} onSave={saveSubmission} onRetry={resetPractice} memo={memo} setMemo={setMemo} />}
        </section>
      ) : <TeacherView submissions={submissions} stats={stats} />}
    </main>
  )
}

function ResultPanel({ result, image, onSave, onRetry, memo, setMemo }) {
  const score = scoreOf(result)
  const labels = { match: '잘 읽혔어요', mismatch: '다르게 읽혔어요', uncertain: '확인이 필요해요' }
  return <section className="result-section">
    <div className="result-heading"><div><p className="eyebrow">판독 결과</p><h2>우와, 열심히 썼어요! 🎉</h2></div><div className="score"><b>{score}</b><span>가독성 점수</span></div></div>
    {result.demo && <p className="demo-note">데모 결과예요. Netlify에 <code>GEMINI_API_KEY</code>를 등록하면 실제 AI 판독을 사용합니다.</p>}
    <div className="result-grid">
      <div className="card source-mini"><h3>내가 쓴 글씨</h3><img src={image.dataUrl} alt="학생 손글씨 원본" /></div>
      <div className="card readout"><h3>AI가 읽은 글씨 <span className="confidence">확신도 {result.overallConfidence === 'high' ? '높음' : result.overallConfidence === 'low' ? '낮음' : '보통'}</span></h3><div className="char-row">{result.characters.map((item, index) => item.expected === ' ' ? <span className="space" key={index}> </span> : <span key={index} className={`char ${palette[item.status]}`} title={`${item.expected} → ${item.recognized}: ${labels[item.status]}`}>{item.recognized}</span>)}</div><div className="legend">{Object.entries(labels).map(([key, value]) => <span key={key}><i className={palette[key]}></i>{value}</span>)}</div><div className="feedback"><span>🌱</span><p>{result.feedback}</p></div></div>
    </div>
    <div className="teacher-note"><label>선생님 메모 <textarea value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="예: ㅁ의 네모 모양이 또렷해서 잘 읽혔어요!" /></label></div>
    <div className="result-actions"><button className="secondary" onClick={onRetry}>다시 써 보기</button><button className="primary" onClick={onSave}>내 기록장에 저장하기</button></div>
  </section>
}

function TeacherView({ submissions, stats }) {
  const confused = submissions.flatMap((entry) => entry.result.characters).filter((item) => item.status !== 'match' && item.expected.trim()).map((item) => item.expected)
  const common = confused.length ? [...new Set(confused)].slice(0, 4).join(' · ') : '아직 충분한 기록이 없어요'
  return <section className="content teacher-view">
    <p className="eyebrow">선생님 공간</p><h1>우리 반 손글씨 살펴보기</h1>
    <div className="stats-grid"><Stat icon="📝" value={stats.count} label="제출한 연습" /><Stat icon="✨" value={`${stats.average}점`} label="평균 가독성" /><Stat icon="🔎" value={common} label="더 살펴볼 글자" wide /></div>
    <section className="card records"><div className="records-header"><div><h2>학생 제출 이력</h2><p>AI 판독은 참고용입니다. 결과를 직접 확인해 주세요.</p></div><span>{submissions.length}건</span></div>
      {submissions.length ? <div className="record-list">{submissions.map((entry) => <article key={entry.id} className="record"><div className="record-avatar">{entry.studentName.slice(0, 1)}</div><div><b>{entry.studentName}</b><p>{entry.lessonTitle} · {entry.expectedText}</p><small>{entry.date}{entry.memo ? ` · 메모: ${entry.memo}` : ''}</small></div><strong>{entry.score}점</strong></article>)}</div> : <div className="empty-record">아직 저장된 연습 기록이 없어요.<br />학생 화면에서 첫 결과를 저장해 보세요.</div>}
    </section>
  </section>
}

function Stat({ icon, value, label, wide }) { return <article className={`stat card ${wide ? 'wide' : ''}`}><span>{icon}</span><div><b>{value}</b><small>{label}</small></div></article> }

export default App
