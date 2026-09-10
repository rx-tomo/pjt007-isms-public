import type { GuideArticle } from '../types';

export const ismsVsPrivacyMark: GuideArticle = {
  slug: 'isms-vs-privacy-mark',
  publishedAt: '2026-09-10',
  updatedAt: '2026-09-10',
  related: ['isms-certification-cost', 'iso27001-certification-process', 'isms-required-documents'],
  content: {
    ja: {
      title: 'ISMS（ISO27001）とPマークの違い｜IT企業はどちらを取るべきか比較で解説',
      metaTitle: 'ISMSとPマークの違い｜IT企業はどちらを取るべきか',
      description:
        'ISMS（ISO/IEC 27001）とプライバシーマークの違いを、保護対象・認証範囲・費用・期間・審査サイクルの比較表で整理。BtoBのIT企業がどちらを先に選ぶべきか、両方取得する場合の共通化ポイントまで解説します。',
      lead:
        'ISMS（ISO/IEC 27001）とプライバシーマーク（Pマーク）の最大の違いは**保護対象**です。ISMSは個人情報を含む情報資産全般を対象とする国際規格、Pマークは個人情報の取り扱いに特化した国内の第三者認証制度です。顧客企業からシステムやデータを預かるBtoBのIT企業では、取引先の要求としてISMSが挙がることが多く、消費者の個人情報を大量に扱うBtoC事業ではPマークが選ばれやすい、というのが一般的な整理です。',
      blocks: [
        { type: 'h2', id: 'difference-at-a-glance', text: 'ISMSとPマークの違いを一言でいうと' },
        {
          type: 'p',
          text:
            '両者はしばしば「どちらも情報セキュリティの認証」とまとめて語られますが、守ろうとしている対象がそもそも異なります。ISMSは、サーバやソースコード、契約情報、ノウハウといった**情報資産全般**を対象にし、機密性・完全性・可用性の3つの観点でリスクを管理する仕組みそのものを審査します。一方のPマークは、対象を**個人情報**に絞り、その取得から利用、保管、廃棄までの取り扱いが適切かを審査します。',
        },
        {
          type: 'p',
          text:
            'この違いから、次のような性格の差が生まれます。どちらが優れているという関係ではなく、事業がどんな情報を扱い、誰から何を求められているかで選ぶものだと考えてください。',
        },
        {
          type: 'ul',
          items: [
            'ISMSは適用範囲を選べるため、特定のサービスや開発部門だけを対象に取得できる',
            'Pマークは原則として法人全体が対象になるため、部分適用という考え方をとらない',
            'ISMSは国際規格なので、海外の取引先や海外拠点にもそのまま説明できる',
            'Pマークはロゴの認知度が高く、国内の一般消費者向けに信頼を示しやすい',
          ],
        },
        { type: 'h2', id: 'what-is-isms', text: 'ISMS（ISO/IEC 27001）とは' },
        {
          type: 'p',
          text:
            'ISMSは Information Security Management System（情報セキュリティマネジメントシステム）の略で、その要求事項を定めた国際規格が ISO/IEC 27001 です。現行版は2022年版で、附属書Aの管理策は93項目に再編されています。特徴は、個別のセキュリティ対策の有無を点検するのではなく、**リスクアセスメントに基づいて自社に必要な管理策を選び、運用し、改善していく仕組み**が回っているかを見る点にあります。',
        },
        {
          type: 'p',
          text:
            'そのため、方針の策定、リスクの特定と評価、適用宣言書の作成、内部監査、マネジメントレビューといった一連のプロセスと、それを裏づける記録の整備が求められます。何をどこまで文書化するかは[ISMSに必要な文書一覧](/guide/isms-required-documents)で整理しています。取得までの流れは[ISO27001認証取得の進め方](/guide/iso27001-certification-process)を参照してください。',
        },
        { type: 'h2', id: 'what-is-privacy-mark', text: 'プライバシーマーク（Pマーク）とは' },
        {
          type: 'p',
          text:
            'プライバシーマークは、一般財団法人日本情報経済社会推進協会（JIPDEC）が運営する、個人情報の取り扱いに関する第三者認証制度です。準拠基準は日本産業規格の **JIS Q 15001**（個人情報保護マネジメントシステム）で、個人情報保護法の考え方を踏まえつつ、規格として求められる管理の水準を定めています。',
        },
        {
          type: 'p',
          text:
            '審査では、個人情報の特定と台帳の整備、利用目的の通知・公表、本人からの開示等請求への対応手順、委託先の管理、従業者教育といった項目が確認されます。名刺や採用応募者の情報まで含めて棚卸しすることになるため、対象範囲が法人全体に及ぶ点が実務上の負担になりやすいところです。',
        },
        { type: 'h2', id: 'comparison-table', text: 'ISMSとPマークの比較表' },
        {
          type: 'table',
          headers: ['比較軸', 'ISMS（ISO/IEC 27001）', 'プライバシーマーク（Pマーク）'],
          rows: [
            ['規格・準拠基準', 'ISO/IEC 27001:2022（国際規格）', 'JIS Q 15001（国内規格）'],
            ['保護対象', '個人情報を含む情報資産全般（機密性・完全性・可用性）', '個人情報に特化'],
            ['認証単位', '適用範囲を部門・拠点・サービス単位で選べる', '原則として法人全体'],
            ['国際通用性', '国際規格として海外の取引先にも通用する', '国内向けの制度が中心'],
            ['審査サイクル', '初回審査 → 年次サーベイランス → 3年ごとの更新審査', '2年ごとの更新審査'],
            ['費用感', '審査費用と支援費用を合わせて数十万円〜数百万円の幅', 'ISMSと同程度、条件次第でやや抑えめになることもある'],
            ['期間感', '準備開始から半年〜1年程度が一つの目安', 'おおむね半年〜1年程度'],
            ['向いている企業', 'BtoBのIT企業、SaaS事業者、受託開発、海外取引がある企業', '消費者の個人情報を大量に扱うBtoC事業、人材・通販・会員サービス'],
          ],
        },
        {
          type: 'p',
          text:
            '費用と期間は、従業員数、拠点数、適用範囲の広さ、既存ルールの整備状況で大きく変わるため、ここでは幅で示しています。金額の内訳や変動要因は[ISMS認証取得の費用相場](/guide/isms-certification-cost)で詳しく扱っています。',
        },
        {
          type: 'callout',
          title: '審査サイクルの違いに注意',
          text:
            'ISMSは3年周期で、その間に年次のサーベイランス審査が入ります。Pマークは2年ごとの更新審査で、間の年に定期審査がありません。年間を通した運用の負荷はISMSの方が平準化されやすく、Pマークは更新年に作業が集中しやすい、という違いが出ます。',
        },
        { type: 'h2', id: 'how-to-choose', text: 'どちらを取るべきかの判断軸' },
        {
          type: 'p',
          text:
            '「どちらが正解か」は業種では決まりません。次の5つの軸で自社の状況を見ると、優先順位が整理しやすくなります。',
        },
        {
          type: 'ul',
          items: [
            '**取引先からの要求**：提案時のセキュリティチェックシートや入札条件でどちらの名前が出ているか。最も強い決め手になります',
            '**扱う情報の種類**：預かるのが顧客企業のシステム・ソースコード・営業機密ならISMS、消費者の個人情報が中心ならPマークが軸になります',
            '**海外取引の有無**：海外の顧客や監査に説明する必要があるなら、国際規格であるISMSの方が話が早くなります',
            '**社内の体制**：Pマークは全社が対象になるため、拠点や事業が多いほど負担が増えます。ISMSは範囲を絞って始められます',
            '**将来の拡張**：まず一つのサービスで取得し、あとから適用範囲を広げていく想定があるならISMSが適しています',
          ],
        },
        {
          type: 'p',
          text:
            '〜100名規模のBtoB向けIT企業では、取引先のセキュリティ要求がISO/IEC 27001を名指しするケースが多く、結果としてISMSが先になることが少なくありません。ただし個人情報を主要な商材として扱っているなら、この限りではありません。',
        },
        { type: 'h2', id: 'both-certifications', text: '両方取得するケースと共通化できる部分' },
        {
          type: 'p',
          text:
            '両方を保有する企業もあります。典型的なのは、BtoBのSaaSを提供しながら、エンドユーザーの個人情報も預かっている場合や、大手企業との取引でISMS、官公庁や自治体案件でPマークをそれぞれ求められる場合です。この場合、ゼロから二つの体制を作るのではなく、共通部分を一本化して運用するのが現実的です。',
        },
        {
          type: 'ul',
          items: [
            '基本方針・目的の文書：情報セキュリティ方針と個人情報保護方針を体系として整合させる',
            '従業者教育：年次教育の教材と受講記録を統合し、個人情報保護の単元を章として組み込む',
            'インシデント対応：報告経路・初動・記録様式を一本化し、個人情報漏えい時の追加手順を分岐として持つ',
            '文書管理：版数管理、承認、保管期間、廃棄のルールを共通の枠組みで運用する',
            '内部監査：チェック項目は分けつつ、年間計画と監査員の育成は共通化する',
          ],
        },
        {
          type: 'p',
          text:
            'リスクアセスメントと適用宣言書はISMS固有、個人情報の特定と台帳はPマーク固有の色が濃い部分なので、ここは分けて持つ方が結果的に管理しやすくなります。',
        },
        { type: 'h2', id: 'common-misconceptions', text: 'よくある誤解' },
        {
          type: 'p',
          text:
            '相談の場でよく見かける、噛み合っていない前提を3つ挙げます。いずれも、認証の位置づけを取り違えていることから生まれます。',
        },
        {
          type: 'callout',
          title: '「Pマークがあるから ISMS は不要」',
          text:
            'Pマークが対象とするのは個人情報です。顧客企業から預かるソースコードや設計情報、社内の営業機密は対象外なので、取引先が情報資産全般の管理体制を求めている場合、Pマークだけでは回答としてかみ合わないことがあります。',
        },
        {
          type: 'p',
          text:
            '二つ目は「ISMSを取れば個人情報保護法への対応も自動的に済む」という誤解です。ISMSは情報資産の管理の仕組みを問うもので、法令そのものへの適合を判定する制度ではありません。利用目的の特定・通知、本人からの請求への対応、漏えい時の報告義務など、法が個別に求める事項への対応は別途必要になります。三つ目は「認証を取れば事故が起きない」という理解です。認証は仕組みが機能していることを第三者が確認したという事実であって、事故の不発生を意味するものではありません。',
        },
        { type: 'h2', id: 'next-step', text: 'まず自社の現在地を確認する' },
        {
          type: 'p',
          text:
            'どちらを選ぶにせよ、判断の前提になるのは「いま自社に何があり、何が足りていないか」です。方針や規程が一部だけ存在する、資産の一覧はあるがリスク評価まで至っていない、教育は実施しているが記録が残っていない——実際の出発点は企業ごとにかなり違います。',
        },
        {
          type: 'p',
          text:
            '設問に答えるだけで現在地を可視化できる[ISMS現在地セルフチェック](/research)を用意しています。ISMSとPマークのどちらを軸にするか迷っている段階でも、不足している領域が見えると比較の議論が進めやすくなります。',
        },
      ],
      faq: [
        {
          question: 'ISMSとPマークは両方必要ですか',
          answer:
            '両方が必須になる企業は限られます。BtoBのIT企業で取引先からISO/IEC 27001を求められているなら、まずISMSで足りることが多い一方、消費者の個人情報を大規模に扱う事業や、Pマークを条件とする案件がある場合は両方の保有が現実的な選択になります。判断は、実際に受け取っているセキュリティ要求の内容から逆算するのが確実です。',
        },
        {
          question: '先に取るならどちらがおすすめですか',
          answer:
            '一般論として、適用範囲を絞って始められるISMSの方が着手しやすい傾向があります。特定のサービスや開発部門から始めて、運用が回ってから範囲を広げられるためです。ただし取引先がPマークを名指ししているなら、その要求が優先します。どちらを先に置くかは、直近1年で失注や条件交渉につながっている要求から決めるとぶれません。',
        },
        {
          question: 'Pマークの内容はISMSに流用できますか',
          answer:
            'かなりの部分が流用できます。方針体系、従業者教育、インシデント対応、文書・記録の管理、内部監査の運営、委託先の管理といった土台は共通です。一方でISMSでは、情報資産の洗い出しとリスクアセスメント、附属書Aの管理策に対する適用宣言書の作成が新たに必要になります。ゼロからではなく、不足分の追加として計画できると考えてよいでしょう。',
        },
        {
          question: 'ISMSに個人情報保護の拡張はありますか',
          answer:
            'ISO/IEC 27701 という規格があり、ISO/IEC 27001 のISMSを土台に、プライバシー情報の管理（PIMS）を追加する拡張として位置づけられています。既にISMSを運用している組織が、個人情報の取り扱いについて国際的に説明したい場合の選択肢になります。国内の商習慣ではPマークの認知度が高いため、目的が国内取引先への提示なのか、海外を含む説明なのかで検討先が変わります。',
        },
        {
          question: '費用と期間はどのくらい違いますか',
          answer:
            'いずれも従業員数、拠点数、適用範囲、既存ルールの整備状況で大きく変動するため、単純比較はできません。目安としては、準備開始から取得までおおむね半年から1年程度、費用は審査と支援を合わせて数十万円から数百万円の幅で語られることが多い、という水準感です。適用範囲を絞れるISMSは、初回の負担を小さく設計できる余地がある点が違いになります。',
        },
      ],
      keywords: [
        'ISMS Pマーク 違い',
        'ISO27001 プライバシーマーク どっち',
        'ISMS プライバシーマーク 比較',
        'JIS Q 15001',
        'ISO/IEC 27001',
        '認証範囲',
        '両方取得',
        'IT企業 認証',
        'BtoB セキュリティ認証',
      ],
    },
    en: {
      title: 'ISMS (ISO 27001) vs Privacy Mark: Which Certification Should a Japanese IT Company Choose?',
      metaTitle: 'ISMS vs Privacy Mark: Which Should IT Firms Get?',
      description:
        'ISMS (ISO/IEC 27001) vs the Japanese Privacy Mark: scope of protection, certification boundary, cost, timeline and audit cycle, and which fits a B2B IT company.',
      lead:
        'The core difference between ISMS (ISO/IEC 27001) and the Privacy Mark (P Mark), a Japanese certification based on JIS Q 15001, is **what each one protects**. ISMS covers information assets as a whole, including personal data, under an international standard. The Privacy Mark focuses specifically on how personal information is handled inside a Japanese company. B2B IT companies that hold client systems and data are more often asked for ISMS, while B2C businesses handling large volumes of consumer data more often pursue the Privacy Mark.',
      blocks: [
        { type: 'h2', id: 'difference-at-a-glance', text: 'The difference in one sentence' },
        {
          type: 'p',
          text:
            'The two are often lumped together as security certifications, but they protect different things. ISMS looks at **information assets in general** such as servers, source code, contracts and know-how, and audits the management system that keeps confidentiality, integrity and availability under control. The Privacy Mark narrows the target to **personal information** and audits how it is collected, used, stored and disposed of.',
        },
        {
          type: 'p',
          text:
            'That single distinction produces most of the practical differences below. Neither is superior; the right choice depends on what information your business handles and what your customers are actually asking for.',
        },
        {
          type: 'ul',
          items: [
            'ISMS lets you define the scope, so a single service or engineering unit can be certified',
            'The Privacy Mark applies to the legal entity as a whole, with no partial-scope concept',
            'ISMS is an international standard, so it can be presented to overseas customers as is',
            'The Privacy Mark logo is widely recognised by Japanese consumers and signals trust domestically',
          ],
        },
        { type: 'h2', id: 'what-is-isms', text: 'What ISMS (ISO/IEC 27001) is' },
        {
          type: 'p',
          text:
            'ISMS stands for Information Security Management System, and ISO/IEC 27001 is the international standard that sets out its requirements. The current edition is the 2022 revision, whose Annex A reorganises the controls into 93 items. Rather than checking whether individual security measures exist, the audit asks whether a **cycle of selecting controls from a risk assessment, operating them and improving them** is genuinely running.',
        },
        {
          type: 'p',
          text:
            'In practice that means a policy, risk identification and evaluation, a Statement of Applicability, internal audits and management review, together with the records that evidence them. For what has to be written down, see [the ISMS document list](/guide/isms-required-documents); for the path to certification, see [how ISO 27001 certification works](/guide/iso27001-certification-process).',
        },
        { type: 'h2', id: 'what-is-privacy-mark', text: 'What the Privacy Mark is' },
        {
          type: 'p',
          text:
            'The Privacy Mark (P Mark) is a Japanese third-party certification for the handling of personal information, operated by JIPDEC (Japan Institute for Promotion of Digital Economy and Community). Its basis is **JIS Q 15001**, the Japanese Industrial Standard for a personal information protection management system, which reflects the thinking of the Act on the Protection of Personal Information while setting its own management requirements.',
        },
        {
          type: 'p',
          text:
            'An audit covers the inventory of personal information held, notification and publication of purposes of use, procedures for handling disclosure requests from individuals, supervision of subcontractors, and employee training. Because everything down to business cards and job applications is in scope, the entity-wide boundary is what makes this the heavier lift for many companies.',
        },
        { type: 'h2', id: 'comparison-table', text: 'ISMS and Privacy Mark side by side' },
        {
          type: 'table',
          headers: ['Dimension', 'ISMS (ISO/IEC 27001)', 'Privacy Mark (P Mark)'],
          rows: [
            ['Standard', 'ISO/IEC 27001:2022 (international)', 'JIS Q 15001 (Japanese national standard)'],
            ['What is protected', 'Information assets in general, including personal data (confidentiality, integrity, availability)', 'Personal information only'],
            ['Certification boundary', 'Scope can be set by department, site or service', 'The legal entity as a whole, as a rule'],
            ['International reach', 'Recognised internationally by overseas customers', 'Primarily a domestic Japanese scheme'],
            ['Audit cycle', 'Initial audit, annual surveillance, renewal every three years', 'Renewal audit every two years'],
            ['Cost range', 'Audit plus support fees typically discussed in a range from the low hundreds of thousands to several million yen', 'Comparable, and sometimes somewhat lower depending on conditions'],
            ['Timeline', 'Roughly six months to a year from starting preparation', 'Roughly six months to a year'],
            ['Best suited to', 'B2B IT firms, SaaS providers, contract development, companies with overseas business', 'B2C businesses handling large volumes of consumer data: recruitment, e-commerce, membership services'],
          ],
        },
        {
          type: 'p',
          text:
            'Cost and duration vary widely with headcount, number of sites, breadth of scope and how mature your existing rules are, so both are given as ranges. The breakdown and the factors that move it are covered in [the ISMS certification cost guide](/guide/isms-certification-cost).',
        },
        {
          type: 'callout',
          title: 'Mind the audit cycle',
          text:
            'ISMS runs on a three-year cycle with an annual surveillance audit in between. The Privacy Mark is renewed every two years with no interim audit. As a result, ISMS effort tends to be spread evenly across the years, while Privacy Mark work concentrates in the renewal year.',
        },
        { type: 'h2', id: 'how-to-choose', text: 'How to decide which one to pursue' },
        {
          type: 'p',
          text:
            'Industry alone does not settle the question. Looking at your situation through these five lenses usually makes the priority obvious.',
        },
        {
          type: 'ul',
          items: [
            '**What customers ask for**: which name appears on the security questionnaires and tender conditions you receive. This is the strongest signal',
            '**Type of information held**: client systems, source code and trade secrets point to ISMS; consumer personal data points to the Privacy Mark',
            '**Overseas business**: if you must explain your posture to non-Japanese customers or auditors, an international standard travels better',
            '**Internal structure**: the Privacy Mark covers the whole entity, so more sites and business lines mean more work. ISMS can start narrow',
            '**Room to grow**: if you plan to certify one service first and widen later, ISMS is built for that',
          ],
        },
        {
          type: 'p',
          text:
            'Among Japanese B2B IT companies of up to about 100 people, customer security requirements frequently name ISO/IEC 27001 specifically, which is why ISMS often comes first. If personal data is the core of your product, that reasoning does not hold.',
        },
        { type: 'h2', id: 'both-certifications', text: 'Holding both, and what can be shared' },
        {
          type: 'p',
          text:
            'Some companies hold both. The usual reasons are a B2B SaaS that also holds end-user personal data, or enterprise customers asking for ISMS while public-sector work asks for the Privacy Mark. When that happens, building two separate systems from scratch is wasteful; the shared layer should be operated once.',
        },
        {
          type: 'ul',
          items: [
            'Policies: keep the information security policy and the personal information protection policy consistent as one hierarchy',
            'Employee training: merge annual materials and attendance records, with privacy protection as a module inside them',
            'Incident response: unify reporting routes, first response and record formats, with a branch for personal data breaches',
            'Document control: run versioning, approval, retention and disposal on one common framework',
            'Internal audit: keep checklists separate but share the annual plan and auditor development',
          ],
        },
        {
          type: 'p',
          text:
            'Risk assessment and the Statement of Applicability are distinctly ISMS, while the personal information inventory is distinctly Privacy Mark. Keeping those separate is usually easier to maintain than forcing them together.',
        },
        { type: 'h2', id: 'common-misconceptions', text: 'Three common misconceptions' },
        {
          type: 'p',
          text:
            'These three assumptions come up often, and each stems from misreading what a certification represents.',
        },
        {
          type: 'callout',
          title: 'We have the Privacy Mark, so we do not need ISMS',
          text:
            'The Privacy Mark covers personal information. Client source code, design documents and internal trade secrets are outside it, so when a customer asks how you manage information assets in general, the Privacy Mark alone may not answer the question they asked.',
        },
        {
          type: 'p',
          text:
            'The second is the belief that certifying to ISMS automatically satisfies the Act on the Protection of Personal Information. ISMS examines a management system for information assets; it is not a determination of legal compliance. Specifying and notifying purposes of use, responding to requests from individuals, and reporting obligations after a breach still have to be handled separately. The third is reading certification as a promise that nothing will go wrong. It records that a third party confirmed the system was functioning, which is not the same as the absence of incidents.',
        },
        { type: 'h2', id: 'next-step', text: 'Start by mapping where you stand' },
        {
          type: 'p',
          text:
            'Whichever route you take, the decision rests on knowing what you already have and what is missing. Policies that exist only in part, an asset inventory with no risk evaluation behind it, training delivered but never recorded: the real starting point differs considerably from company to company.',
        },
        {
          type: 'p',
          text:
            'The [ISMS readiness self-check](/research) makes that visible by answering a short set of questions. Even while you are still weighing ISMS against the Privacy Mark, seeing which areas are thin makes the comparison a much easier conversation to have internally.',
        },
      ],
      faq: [
        {
          question: 'Do we need both ISMS and the Privacy Mark?',
          answer:
            'Few companies genuinely need both. A B2B IT company whose customers name ISO/IEC 27001 is usually served by ISMS alone, while a business handling consumer personal data at scale, or bidding for work that requires the Privacy Mark, may reasonably hold both. Work backwards from the security requirements you actually receive rather than from the industry you are in.',
        },
        {
          question: 'If we can only do one first, which should it be?',
          answer:
            'As a general pattern, ISMS is easier to start because you can limit the scope, certify one service or engineering unit, and widen later once the routine is stable. That said, if a customer has named the Privacy Mark, their requirement wins. Deciding from the requests that cost you deals in the past year keeps the choice grounded.',
        },
        {
          question: 'Can Privacy Mark work be reused for ISMS?',
          answer:
            'A large share of it can. Policy hierarchy, employee training, incident response, document and record control, internal audit operation and subcontractor management are common ground. ISMS adds an information asset inventory, a risk assessment and a Statement of Applicability covering the Annex A controls. Plan it as filling gaps rather than starting over.',
        },
        {
          question: 'Is there a privacy extension to ISMS?',
          answer:
            'ISO/IEC 27701 exists as an extension that builds a privacy information management system (PIMS) on top of an ISO/IEC 27001 ISMS. It suits an organisation already running ISMS that wants to explain its handling of personal data internationally. Within Japan the Privacy Mark carries more name recognition, so the right choice depends on whether your audience is domestic or global.',
        },
        {
          question: 'How different are the cost and the timeline?',
          answer:
            'Both move so much with headcount, sites, scope and existing maturity that a direct comparison is unreliable. As a rough sense of scale, preparation to certification is often discussed as six months to a year, and audit plus support fees in a range from the low hundreds of thousands to several million yen. The meaningful difference is that ISMS scope can be narrowed to keep the first cycle smaller.',
        },
      ],
      keywords: [
        'ISMS vs Privacy Mark',
        'ISO 27001 or Privacy Mark',
        'JIS Q 15001',
        'ISO/IEC 27001 certification',
        'certification scope',
        'holding both certifications',
        'Japanese IT company security certification',
        'B2B security certification',
      ],
    },
    zh: {
      title: 'ISMS（ISO 27001）与日本隐私标志（P Mark）的区别｜IT企业该选哪一个',
      metaTitle: 'ISMS与P Mark的区别｜IT企业该选哪个',
      description:
        '从保护对象、认证范围、费用、周期和审核频率对比ISMS（ISO/IEC 27001）与日本隐私标志（P Mark），说明面向企业客户的日本IT公司应优先选择哪一个，以及同时取得时可共用的部分。',
      lead:
        'ISMS（ISO/IEC 27001）与隐私标志（Privacy Mark / P Mark，基于 JIS Q 15001 的日本国内认证制度）最大的区别在于**保护对象**。ISMS是覆盖包括个人信息在内的全部信息资产的国际标准，而P Mark专门针对个人信息的处理。承接客户系统与数据的BtoB型IT企业，客户方多半会点名ISMS；大量处理消费者个人信息的BtoC业务，则更常选择P Mark。',
      blocks: [
        { type: 'h2', id: 'difference-at-a-glance', text: '一句话说清两者的区别' },
        {
          type: 'p',
          text:
            '两者常被笼统地称为「信息安全认证」，但它们要保护的东西本来就不同。ISMS面向**全部信息资产**，包括服务器、源代码、合同信息与技术诀窍，审核的是从机密性、完整性、可用性三个角度管理风险的机制本身。P Mark则把对象收敛到**个人信息**，审核其取得、利用、保管、废弃的整个处理流程是否恰当。',
        },
        {
          type: 'p',
          text:
            '由此产生了下面这些性质上的差异。这不是谁更优秀的问题，而是要看企业处理什么信息、被谁要求了什么。',
        },
        {
          type: 'ul',
          items: [
            'ISMS可以自行界定适用范围，因此可以只针对某项服务或某个开发部门取得',
            'P Mark原则上以法人整体为对象，没有部分适用的概念',
            'ISMS是国际标准，可以直接向海外客户和海外据点说明',
            'P Mark标识在日本国内认知度高，便于向一般消费者展示信任感',
          ],
        },
        { type: 'h2', id: 'what-is-isms', text: '什么是ISMS（ISO/IEC 27001）' },
        {
          type: 'p',
          text:
            'ISMS是Information Security Management System（信息安全管理体系）的简称，规定其要求的国际标准即ISO/IEC 27001。现行版本为2022年版，附录A的控制措施重新整合为93项。其特点在于，不是逐项检查是否具备某种安全措施，而是看**基于风险评估选择所需控制措施、加以运行并持续改进的机制**是否真正在运转。',
        },
        {
          type: 'p',
          text:
            '因此需要方针制定、风险识别与评价、适用性声明的编制、内部审核、管理评审这一整套流程，以及支撑它们的记录。文件需要做到什么程度，可参考[ISMS所需文件清单](/guide/isms-required-documents)；取得的整体流程请见[ISO 27001认证取得的推进方式](/guide/iso27001-certification-process)。',
        },
        { type: 'h2', id: 'what-is-privacy-mark', text: '什么是隐私标志（P Mark）' },
        {
          type: 'p',
          text:
            '隐私标志是由一般财团法人日本信息经济社会推进协会（JIPDEC）运营的、针对个人信息处理的第三方认证制度。其依据标准是日本工业规格 **JIS Q 15001**（个人信息保护管理体系），在参照个人信息保护法思路的同时，规定了作为标准所要求的管理水平。',
        },
        {
          type: 'p',
          text:
            '审核内容包括个人信息的识别与台账整备、利用目的的告知与公示、对本人开示请求的处理程序、委托方管理以及员工教育等。由于连名片和应聘者信息都要纳入盘点，适用范围覆盖法人整体这一点，在实务上往往是负担较重的地方。',
        },
        { type: 'h2', id: 'comparison-table', text: 'ISMS与P Mark对比表' },
        {
          type: 'table',
          headers: ['对比项', 'ISMS（ISO/IEC 27001）', '隐私标志（P Mark）'],
          rows: [
            ['标准依据', 'ISO/IEC 27001:2022（国际标准）', 'JIS Q 15001（日本国内标准）'],
            ['保护对象', '包含个人信息在内的全部信息资产（机密性、完整性、可用性）', '仅限个人信息'],
            ['认证单位', '可按部门、据点、服务界定适用范围', '原则上为法人整体'],
            ['国际通用性', '作为国际标准，对海外客户同样适用', '以日本国内制度为主'],
            ['审核周期', '首次审核 → 每年监督审核 → 每三年更新审核', '每两年更新审核'],
            ['费用区间', '审核费用与支持费用合计，常在数十万至数百万日元的区间内讨论', '大致相当，视条件有时略低'],
            ['所需周期', '从启动准备到取得，大致半年至一年左右', '大致半年至一年左右'],
            ['适合的企业', 'BtoB型IT企业、SaaS服务商、受托开发、有海外业务的企业', '大量处理消费者个人信息的BtoC业务，如人才、电商、会员服务'],
          ],
        },
        {
          type: 'p',
          text:
            '费用与周期会随员工人数、据点数量、适用范围大小以及既有制度的完备程度大幅变化，因此这里以区间表示。金额构成与影响因素在[ISMS认证取得的费用行情](/guide/isms-certification-cost)中有更详细的说明。',
        },
        {
          type: 'callout',
          title: '注意审核周期的差异',
          text:
            'ISMS以三年为一个周期，其间每年有监督审核。P Mark则是每两年一次更新审核，中间年份没有定期审核。结果是ISMS的年度运行负担较为平均，而P Mark容易在更新年份出现工作集中。',
        },
        { type: 'h2', id: 'how-to-choose', text: '判断该选哪一个的五个视角' },
        {
          type: 'p',
          text:
            '「哪个是正确答案」并不由行业决定。从以下五个视角审视自身情况，优先顺序通常就会清晰起来。',
        },
        {
          type: 'ul',
          items: [
            '**客户方的要求**：提案时的安全检查表或投标条件里点名的是哪一个。这是最强的判断依据',
            '**处理信息的类型**：承接的是客户企业的系统、源代码与商业机密则偏向ISMS；以消费者个人信息为主则偏向P Mark',
            '**是否有海外业务**：需要向海外客户或审计方说明时，作为国际标准的ISMS更容易沟通',
            '**内部组织结构**：P Mark以全公司为对象，据点与业务线越多负担越大；ISMS可以从较小范围起步',
            '**未来的扩展**：若计划先就一项服务取得、之后再扩大范围，ISMS更契合这一路径',
          ],
        },
        {
          type: 'p',
          text:
            '在100人规模以内、面向企业客户的日本IT公司中，客户的安全要求常常直接点名ISO/IEC 27001，结果ISMS先行的情况并不少见。但如果个人信息本身就是核心业务，则不适用这一判断。',
        },
        { type: 'h2', id: 'both-certifications', text: '同时取得的情形与可共用的部分' },
        {
          type: 'p',
          text:
            '也有企业同时持有两者。典型情况是：提供BtoB型SaaS的同时也保管终端用户的个人信息；或者与大型企业交易时被要求ISMS，而政府与地方自治体项目则要求P Mark。此时与其从零搭建两套体系，不如把共通部分统一起来运行更为现实。',
        },
        {
          type: 'ul',
          items: [
            '方针文件：让信息安全方针与个人信息保护方针在体系上保持一致',
            '员工教育：整合年度教材与受训记录，把个人信息保护作为其中一个单元',
            '事件响应：统一报告路径、初期处置与记录格式，个人信息泄露时的追加步骤作为分支处理',
            '文件管理：版本管理、审批、保存期限与废弃规则采用同一套框架',
            '内部审核：检查项目分开，但年度计划与审核员培养可以共用',
          ],
        },
        {
          type: 'p',
          text:
            '风险评估与适用性声明是ISMS特有的，个人信息的识别与台账则是P Mark特有的，这些部分分开管理反而更容易维护。',
        },
        { type: 'h2', id: 'common-misconceptions', text: '三个常见的误解' },
        {
          type: 'p',
          text:
            '以下三种前提在咨询中经常出现，它们都源于对认证定位的误读。',
        },
        {
          type: 'callout',
          title: '「有了P Mark就不需要ISMS」',
          text:
            'P Mark的对象是个人信息。从客户处承接的源代码、设计资料以及公司内部的商业机密并不在范围内，因此当客户要求说明信息资产整体的管理体制时，仅凭P Mark可能答非所问。',
        },
        {
          type: 'p',
          text:
            '第二个是「取得ISMS后个人信息保护法的合规也自动完成了」。ISMS考察的是信息资产的管理机制，并不是判定是否符合法律本身的制度。利用目的的特定与告知、对本人请求的处理、泄露时的报告义务等法律单独要求的事项，仍需另行应对。第三个是把认证理解为「不会再出事故」。认证记录的是第三方确认了机制在运转这一事实，与事故不会发生并不是一回事。',
        },
        { type: 'h2', id: 'next-step', text: '先确认自家企业目前的位置' },
        {
          type: 'p',
          text:
            '无论选择哪一条路径，判断的前提都是弄清「现在自家企业有什么、缺什么」。方针与规程只存在一部分、有资产清单但没有做到风险评价、教育实施了却没有留下记录——实际的起点因企业而异，差别相当大。',
        },
        {
          type: 'p',
          text:
            '我们准备了只需回答若干问题即可可视化当前位置的[ISMS现状自查](/research)。即使还在纠结以ISMS还是P Mark为主轴，先看清哪些领域存在不足，内部的比较讨论也会更容易推进。',
        },
      ],
      faq: [
        {
          question: 'ISMS和P Mark两个都需要吗？',
          answer:
            '两者都成为必需的企业其实有限。面向企业客户的IT公司如果被点名要求ISO/IEC 27001，多数情况下ISMS就已足够；而大规模处理消费者个人信息的业务，或存在以P Mark为条件的项目时，同时持有才是现实选择。从实际收到的安全要求内容倒推来判断最为可靠。',
        },
        {
          question: '如果只能先取一个，建议先取哪个？',
          answer:
            '一般而言，可以缩小适用范围起步的ISMS更容易着手：先从某项服务或开发部门开始，运行稳定后再扩大范围。不过如果客户明确点名P Mark，则以该要求优先。参考最近一年中导致失单或条件谈判的要求来决定顺序，判断不容易动摇。',
        },
        {
          question: 'P Mark的成果可以沿用到ISMS吗？',
          answer:
            '相当大一部分可以沿用。方针体系、员工教育、事件响应、文件与记录管理、内部审核的运营、委托方管理等基础是共通的。而ISMS新增的部分是信息资产的盘点与风险评估，以及针对附录A控制措施编制适用性声明。可以按「补足差额」而非「从零开始」来规划。',
        },
        {
          question: 'ISMS有针对个人信息保护的扩展吗？',
          answer:
            '有ISO/IEC 27701这一标准，它被定位为在ISO/IEC 27001的ISMS之上追加隐私信息管理（PIMS）的扩展。适合已经在运行ISMS、并希望就个人信息处理向国际方面进行说明的组织。在日本国内的商业习惯中P Mark认知度更高，因此要看目的是面向国内客户展示，还是包含海外在内的说明。',
        },
        {
          question: '费用和周期差别有多大？',
          answer:
            '两者都会随员工人数、据点数量、适用范围与既有制度完备程度大幅变动，难以简单比较。作为大致的量级感受：从启动准备到取得通常以半年至一年来讨论，费用则在审核与支持合计数十万至数百万日元的区间内被提及。差异在于ISMS可以缩小适用范围，从而把首个周期的负担设计得更小。',
        },
      ],
      keywords: [
        'ISMS 与 P Mark 区别',
        'ISO 27001 隐私标志 选哪个',
        'ISMS 隐私标志 对比',
        'JIS Q 15001',
        'ISO/IEC 27001 认证',
        '认证范围',
        '同时取得',
        '日本IT企业 安全认证',
      ],
    },
  },
};
