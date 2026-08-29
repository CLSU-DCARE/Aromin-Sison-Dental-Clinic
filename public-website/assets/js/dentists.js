// ---------- Dentist profiles (data-driven) ----------
// Add a clinician by appending one object to DENTISTS: name, title, bio,
// quote, expertise tags, credentials, and awards. Each profile uses a
// portrait photo. Falls back to a monogram if no photo is provided.
(function(){
  const DENTISTS = [
    {
      initials: 'DA',
      photo: '../shared/images/dr arsenia.png',
      name: 'Dr. Arsenia Aromin',
      title: 'Founding Dentist: General &amp; Restorative Dentistry',
      alt: false,
      bio: [
        'Dr. Arsenia Aromin founded Aromin-Sison Dental Clinic in 1985 with a simple goal: to make world-class dental care feel personal rather than clinical. Over four decades, that founding philosophy has shaped every part of how the clinic runs: from unhurried appointment scheduling to the way treatment plans are explained.',
        'Today, Dr. Arsenia Aromin leads diagnostics and restorative treatment, with a particular focus on digital imaging and long-term oral health planning. Patients often describe the experience as feeling more like a conversation with a trusted advisor than a routine dental visit.'
      ],
      quote: '"I\'ve always believed that if you take the time to explain what you see, patients make better decisions about their own health, and trust follows naturally."',
      expertise: [
        'Restorative Dentistry',
        'Digital Imaging &amp; Scanning',
        'Root Canal Therapy',
        'Preventive Care',
        'Oral Health Planning'
      ],
      creds: [
        'Doctor of Dental Medicine (DMD)',
        'Licensed Dentist, Professional Regulation Commission (PRC)',
        'Certified in Digital Radiography &amp; Guided Imaging',
        'Continuing Education, Restorative &amp; Endodontic Techniques'
      ],
      awards: [
        'Member, Philippine Dental Association',
        'Featured, Manila Dental Review (2026)',
        '40 Years of Continuous Practice, Nueva Ecija'
      ]
    },
    {
      initials: 'DS',
      photo: '../shared/images/dr kathrine.png',
      name: 'Dr. Kathrine Sison',
      title: 'Lead Dentist: Orthodontics &amp; Cosmetic Dentistry',
      alt: true,
      bio: [
        'Dr. Kathrine Sison joined the clinic as part of its second generation of clinicians, bringing a focus on orthodontics and cosmetic dentistry that has become central to the practice. From first consultation through every adjustment along the way, Dr. Kathrine Sison manages braces and cosmetic treatment plans with the same unhurried approach the clinic was built on.',
        'Known among patients for a calm, detail-oriented chairside manner, Dr. Kathrine Sison takes particular care with younger patients and first-time orthodontic cases, walking through each stage of treatment before it begins.'
      ],
      quote: '"A smile is something people carry with them every day. I want every patient to feel confident about the plan we\'ve built together, not just the end result."',
      expertise: [
        'Orthodontics &amp; Braces',
        'Cosmetic Dentistry',
        'Teeth Whitening',
        'Veneers',
        'Smile Design'
      ],
      creds: [
        'Doctor of Dental Medicine (DMD)',
        'Licensed Dentist, Professional Regulation Commission (PRC)',
        'Certificate in Clinical Orthodontics',
        'Advanced Training, Cosmetic &amp; Aesthetic Dentistry'
      ],
      awards: [
        'Member, Philippine Dental Association',
        'Member, Philippine Orthodontic Society'
      ]
    }
  ];

  const grid = document.getElementById('dentistGrid');
  if (!grid) return;

  const checkIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>';
  const medalIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M8.21 13.89 7 23l5-3 5 3-1.21-9.12"/></svg>';

  grid.innerHTML = DENTISTS.map(d =>
    `<div class="dentist-profile${d.alt ? ' alt-side' : ''}">
      <div class="dentist-photo">${d.photo ? `<img src="${d.photo}" alt="${d.name}" style="width:100%;height:100%;object-fit:cover;">` : `<span class="team-mono" aria-hidden="true">${d.initials}</span>`}</div>
      <div>
        <div class="dentist-name">${d.name}</div>
        <div class="dentist-title">${d.title}</div>
        <div class="dentist-bio">${d.bio.map(p => `<p>${p}</p>`).join('')}</div>
        <blockquote class="dentist-quote">${d.quote}</blockquote>
        <div class="dentist-block-label">Areas of Expertise</div>
        <div class="expertise-tags">${d.expertise.map(t => `<span class="expertise-tag">${t}</span>`).join('')}</div>
        <div class="dentist-block-label">Qualifications &amp; Certifications</div>
        <ul class="cred-list">${d.creds.map(c => `<li>${checkIcon} ${c}</li>`).join('')}</ul>
        <div class="dentist-block-label">Awards &amp; Memberships</div>
        <ul class="award-list">${d.awards.map(a => `<li>${medalIcon} ${a}</li>`).join('')}</ul>
      </div>
    </div>`
  ).join('');
})();