import type { GuideArticle } from '../types';

export const ismsCertificationCost: GuideArticle = {
  slug: 'isms-certification-cost',
  publishedAt: '2026-09-10',
  updatedAt: '2026-09-10',
  related: ['iso27001-certification-process', 'isms-required-documents', 'isms-vs-privacy-mark'],
  content: {
    ja: {
      title: 'ISMS（ISO27001）認証取得の費用相場｜審査・コンサル・維持費の内訳と抑え方',
      metaTitle: 'ISMS認証の費用相場｜審査・コンサル・維持費',
      description:
        'ISMS（ISO27001）認証の取得費用は、初回審査費用が数十万〜150万円程度、コンサル費用が100万〜500万円程度が目安です。従業員10名・30名・100名の規模別相場、年間維持費、費用を抑える方法を整理します。',
      lead:
        'ISMS（ISO/IEC 27001）認証の取得にかかる費用は、従業員100名以下のIT企業であれば初年度でおおむね150万〜700万円程度、認証取得後の年間維持費で40万〜200万円程度が一般的な目安です。金額の幅が大きいのは、審査機関へ支払う審査費用よりも、コンサルティング費用と社内の内部工数のほうが総額を大きく左右するためです。この記事では費用を6つの構成要素に分解し、規模別の目安、金額を左右する要因、そして無理なく抑えるための考え方を整理します。',
      blocks: [
        { type: 'h2', id: 'cost-overview', text: 'ISMS認証の費用は「初年度」と「維持」に分けて考える' },
        {
          type: 'p',
          text:
            'ISMS認証の費用を検討するとき、まず切り分けたいのが**初年度にかかる一時費用**と、**認証を維持するために毎年かかる費用**です。初回登録審査は第一段階審査（文書審査）と第二段階審査（実地審査）の2回に分かれ、認証取得後は毎年のサーベイランス審査、3年ごとの更新審査が続きます。つまり認証は「取って終わり」ではなく、3年周期のサイクルとして費用を見積もる必要があります。審査の流れそのものは[ISO27001認証取得の進め方](/guide/iso27001-certification-process)で詳しく解説しています。',
        },
        {
          type: 'p',
          text:
            '初年度の総額に最も影響するのは、審査機関へ支払う費用ではありません。多くの企業でコンサルティング費用と社内担当者の工数が総額の6〜8割を占めます。この2つをどう設計するかが費用コントロールの本丸です。',
        },
        { type: 'h2', id: 'cost-breakdown', text: '費用の内訳｜6つの構成要素' },
        {
          type: 'p',
          text:
            'ISMS認証にかかる費用は、次の要素に分解できます。金額はいずれも一般的な目安であり、審査機関・適用範囲・支援内容によって上下します。',
        },
        {
          type: 'table',
          headers: ['費用項目', '発生タイミング', '目安レンジ', '備考'],
          rows: [
            ['初回登録審査（第一段階＋第二段階）', '取得時', '数十万〜150万円程度', '適用範囲・人数・拠点数で変動'],
            ['登録料・年間管理料', '取得時および毎年', '数万〜数十万円程度', '名称や区分は審査機関により異なる'],
            ['サーベイランス審査', '取得翌年から毎年', '初回審査費用の3〜5割程度', '審査工数が少ないため相対的に低額'],
            ['更新審査', '3年ごと', '初回審査費用の6〜8割程度', '認証の再登録にあたる審査'],
            ['コンサルティング費用', '取得準備期間（半年〜1年）', '100万〜500万円程度', '支援範囲によって最も幅が大きい'],
            ['ツール・SaaS費用', '毎年', '年数万〜数十万円程度', '文書管理・リスク管理・教育記録など'],
            ['内部工数（人件費）', '取得時および毎年', '担当者0.3〜0.5人月／月を半年〜1年', '見落とされやすい最大のコスト'],
            ['教育・研修費', '毎年', '数万〜数十万円程度', '全社教育と内部監査員研修'],
            ['技術的・物理的対策の追加投資', '随時', '0〜数百万円', '既存環境の成熟度次第で大きく変動'],
          ],
        },
        { type: 'h3', id: 'audit-fee', text: '審査費用は「工数（人日）×単価」で決まる' },
        {
          type: 'p',
          text:
            '審査機関の費用は、適用範囲に含まれる要員数と拠点数から算定された審査工数（人日）に単価を掛けて決まるのが一般的です。したがって従業員数が2倍になっても費用が単純に2倍になるわけではなく、増加は緩やかです。見積もりを取る際は、初回登録審査だけでなく、サーベイランス審査と更新審査を含む3年分の総額で比較すると判断を誤りません。',
        },
        { type: 'h3', id: 'internal-effort', text: '見えにくい「内部工数」を金額に換算する' },
        {
          type: 'p',
          text:
            '最も過小評価されやすいのが社内工数です。情報セキュリティ方針、適用宣言書（SoA）、リスクアセスメント手順、各種規程と記録の整備には相応の時間がかかります。必要な文書の全体像は[ISMSで必要な文書一覧](/guide/isms-required-documents)にまとめていますが、担当者1名が半年〜1年にわたり業務時間の3〜5割を割く前提で見積もると現実に近くなります。人件費換算で100万〜300万円相当になることも珍しくありません。',
        },
        { type: 'h2', id: 'cost-by-size', text: '従業員規模別の費用目安' },
        {
          type: 'p',
          text:
            '以下は、単一拠点・情報システム部門を含む一般的なIT企業を想定した目安です。実際の金額は適用範囲や既存の運用状況で変わるため、レンジとして捉えてください。',
        },
        {
          type: 'table',
          headers: ['従業員規模', '初回審査費用', 'コンサル費用', '初年度合計', '年間維持費'],
          rows: [
            ['10名程度', '40万〜80万円程度', '100万〜200万円程度', '150万〜300万円程度', '40万〜80万円程度'],
            ['30名程度', '60万〜110万円程度', '150万〜300万円程度', '250万〜450万円程度', '60万〜120万円程度'],
            ['100名程度', '90万〜150万円程度', '250万〜500万円程度', '400万〜700万円程度', '100万〜200万円程度'],
          ],
        },
        {
          type: 'callout',
          title: '比較するときは「3年総額」で見る',
          text:
            '初年度費用だけで比較すると判断を誤ります。初年度＋サーベイランス審査2回＋維持費を合算した3年総額で並べると、初期費用が安く見えた選択肢が実は割高だった、というケースが可視化されます。',
        },
        { type: 'h2', id: 'cost-factors', text: '費用を左右する5つの要因' },
        {
          type: 'ul',
          items: [
            '**適用範囲（スコープ）**｜全社か特定事業部か、対象拠点はどこまでか。範囲が広いほど審査工数も文書整備工数も増える',
            '**拠点数**｜遠隔地の拠点が対象に含まれると、審査工数に加えて旅費交通費が発生する場合がある',
            '**審査機関の選択**｜認定機関・料金体系・審査員の稼働単価は機関ごとに異なるため、複数から見積もりを取るのが基本',
            '**既存の運用成熟度**｜規程やアクセス管理、ログ取得、資産台帳がすでに整っていれば、追加投資も文書整備工数も小さくなる',
            '**コンサルへの依存度**｜文書を丸ごと作成してもらうのか、レビューと助言だけを受けるのかで費用は数倍変わる',
          ],
        },
        {
          type: 'p',
          text:
            'このうち自社でコントロールしやすいのは適用範囲とコンサル依存度です。適用範囲は最初から全社に広げず、取引先が求めている事業・サービス単位に絞って取得し、後から拡大していく進め方も選択できます。',
        },
        { type: 'h2', id: 'cost-reduction', text: '費用を抑える5つの方法' },
        {
          type: 'ol',
          items: [
            '**適用範囲を必要十分に設定する**｜「なぜ認証が必要か」を取引先要件から逆算し、対象を過剰に広げない',
            '**テンプレートやSaaSを活用する**｜規程・様式・リスクアセスメントの雛形を活用すれば、ゼロから起草する工数を大幅に削減できる',
            '**社内担当者を育成する**｜内部監査員研修などに投資し、2年目以降の運用を内製化すると維持費が下がる',
            '**コンサルを部分利用する**｜リスクアセスメントと適用宣言書（SoA）の妥当性レビュー、審査直前の模擬監査など、要所に絞って依頼する',
            '**公的支援制度の有無を確認する**｜自治体や年度によって利用可能な支援制度が存在する場合があるため、所在自治体の最新情報を必ず確認する',
          ],
        },
        {
          type: 'p',
          text:
            '5つ目については、制度の名称・要件・募集時期は自治体および年度により大きく異なります。該当するかどうかは必ず一次情報で確認してください。',
        },
        { type: 'h2', id: 'opportunity-cost', text: '取得しない場合の機会損失も費用の一部' },
        {
          type: 'p',
          text:
            '費用を判断するときは、支出だけでなく「取得しなかった場合に失うもの」も並べて考える必要があります。近年は、取引開始時のセキュリティチェックシートで認証の有無を問われる、入札参加資格で加点対象になる、SaaS導入審査で第三者証明を求められる、といった場面が増えています。',
        },
        {
          type: 'p',
          text:
            '商談1件の受注規模が数百万円を超える事業であれば、認証がないことで失注や商談長期化が数件発生するだけで、取得費用を上回る損失になり得ます。なお国内では[プライバシーマークとの比較](/guide/isms-vs-privacy-mark)で迷うケースも多く、取引先が求めているのがどちらなのかを先に確認することが、無駄な支出を避ける最短経路です。',
        },
        { type: 'h2', id: 'diy-feasibility', text: '「自社で取得する」選択肢は現実的か' },
        {
          type: 'p',
          text:
            'コンサルを使わず自社のみで認証取得を目指すことは制度上可能です。実際、社内に情報セキュリティの実務経験者がいて、規格本文と附属書Aの管理策を読み解ける体制があり、担当者が一定の時間を確保できる場合には、コンサル費用を丸ごと圧縮できます。',
        },
        {
          type: 'p',
          text:
            '一方で、自社対応には固有のリスクもあります。リスクアセスメントの手順が規格の要求と噛み合わない、適用宣言書（SoA）で管理策の適用・除外理由が説明できない、内部監査とマネジメントレビューの記録が形式的になる、といった不適合は第二段階審査で指摘されやすい典型例です。是正対応で審査が長引けば追加費用が発生し、結果として節約にならないこともあります。',
        },
        {
          type: 'callout',
          title: '判断の目安',
          text:
            '社内に情報セキュリティ実務の経験者がいるなら自社主導＋要所のみ外部レビュー、いない場合は初回のみ支援を受けて2年目以降を内製化する、という組み立てが費用対効果の面でバランスが取りやすい選択肢です。',
        },
        { type: 'h2', id: 'reduce-effort-with-tools', text: 'ツールで内部工数を減らすという考え方' },
        {
          type: 'p',
          text:
            'ここまで見てきたとおり、ISMS認証の費用は審査費用よりも「人が動く時間」に強く依存します。文書のバージョン管理、リスクアセスメントの記録、教育実施記録、内部監査の証跡といった作業をExcelと共有フォルダで回すと、2年目以降の維持工数がそのまま積み上がります。これらを一元管理できる仕組みを持つことは、初年度だけでなく維持フェーズの費用を継続的に押し下げます。',
        },
        {
          type: 'p',
          text:
            '自社の現在地がどの段階にあり、どこに工数が集中しそうかを把握するところから始めるのが有効です。[ISMS現在地セルフチェック](/research)では、いくつかの設問に答えるだけで、いま優先して着手すべき領域を整理できます。見積もりを取る前に社内の状況を言語化しておくと、コンサルや審査機関との話も進めやすくなります。',
        },
      ],
      faq: [
        {
          question: 'ISMS認証の費用は最低いくらから可能ですか？',
          answer:
            '従業員10名程度・単一拠点・適用範囲を絞った小規模な構成であれば、初回審査費用が40万円前後、コンサルを使わず自社対応とした場合の初年度総額で50万〜100万円程度に収まるケースもあります。ただし社内担当者の工数（人件費換算で100万円相当以上になることもある）は別途発生します。',
        },
        {
          question: 'コンサルなしで取得できますか？',
          answer:
            '制度上は可能です。社内に情報セキュリティの実務経験者がおり、規格本文と附属書Aの管理策を読み解ける体制があれば、自社のみで進める企業もあります。ただしリスクアセスメントの手順や適用宣言書（SoA）の説明が不十分だと第二段階審査で不適合を指摘され、是正対応で期間と費用が膨らむ場合があります。',
        },
        {
          question: '維持費は毎年かかりますか？',
          answer:
            'かかります。取得の翌年から毎年サーベイランス審査があり、3年目には更新審査が入ります。これに登録料・年間管理料、教育研修費、ツール費用、内部監査やマネジメントレビューの工数が加わり、年間で40万〜200万円程度が一般的な目安です。',
        },
        {
          question: 'プライバシーマークとISMS認証では、どちらが費用が高いですか？',
          answer:
            '一般に、審査機関へ支払う費用の水準はISMS認証のほうが高くなる傾向があります。ただしプライバシーマークは個人情報保護に対象が絞られ、ISMS認証は情報資産全般を扱うため、単純な金額比較よりも取引先が求めている認証がどちらかを確認することが重要です。詳細は関連記事を参照してください。',
        },
        {
          question: '費用はいつ支払うことになりますか？',
          answer:
            'コンサルティング費用は契約時と各フェーズ完了時に分割で支払う形が多く、審査費用は第一段階審査と第二段階審査の実施時期に前後して請求されるのが一般的です。初年度は支出が集中するため、事業年度をまたぐ場合は予算計上の時期を早めに調整しておくと安全です。',
        },
      ],
      keywords: [
        'ISMS認証 費用',
        'ISO27001 取得費用',
        'ISMS 費用 相場',
        '審査費用',
        'コンサル費用',
        '維持費用',
        '中小企業',
        '自社で取得',
      ],
    },
    en: {
      title: 'ISO 27001 (ISMS) Certification Cost: Audit, Consulting and Maintenance Breakdown',
      metaTitle: 'ISO 27001 Certification Cost: Full Breakdown',
      description:
        'ISO 27001 certification typically costs JPY 1.5M-7M in year one and JPY 400K-2M a year to maintain. See the breakdown by company size and 5 ways to cut it.',
      lead:
        'For a Japanese IT company with fewer than 100 employees, ISO/IEC 27001 (ISMS) certification generally costs somewhere between JPY 1.5 million and 7 million in the first year, plus roughly JPY 400,000 to 2 million per year to maintain. The range is wide because consulting fees and internal staff time, not the certification body audit fee, drive most of the total. This guide breaks the cost into six components, gives size-based benchmarks, explains what moves the number, and shows how to keep it under control.',
      blocks: [
        { type: 'h2', id: 'cost-overview', text: 'Split the Cost Into Year One and Ongoing Maintenance' },
        {
          type: 'p',
          text:
            'The first thing to separate is **one-off first-year cost** and **the recurring cost of keeping the certificate**. Initial certification is carried out as a Stage 1 audit (documentation review) and a Stage 2 audit (on-site review), followed by a surveillance audit every year and a recertification audit every three years. Certification is a three-year cycle, not a one-time purchase, so budget it that way. The sequence itself is covered in [how ISO 27001 certification works](/guide/iso27001-certification-process).',
        },
        {
          type: 'p',
          text:
            'What drives the first-year total is usually not the certification body. In most companies, consulting fees plus the internal owner time account for 60 to 80 percent of the total. Those two levers are where cost control actually happens.',
        },
        { type: 'h2', id: 'cost-breakdown', text: 'Cost Breakdown: Six Components' },
        {
          type: 'p',
          text:
            'ISO 27001 cost can be decomposed as follows. Every figure is a general benchmark and moves with the certification body, the scope and the level of support you buy.',
        },
        {
          type: 'table',
          headers: ['Cost item', 'When it occurs', 'Typical range', 'Notes'],
          rows: [
            ['Initial certification audit (Stage 1 + Stage 2)', 'At certification', 'JPY 400K-1.5M', 'Varies with scope, headcount and sites'],
            ['Registration and annual administration fee', 'At certification and yearly', 'JPY tens of thousands to hundreds of thousands', 'Naming differs by certification body'],
            ['Surveillance audit', 'Every year after certification', '30-50% of the initial audit fee', 'Lower because audit days are fewer'],
            ['Recertification audit', 'Every three years', '60-80% of the initial audit fee', 'Re-registration of the certificate'],
            ['Consulting fees', 'Preparation period (6-12 months)', 'JPY 1M-5M', 'The widest range of all items'],
            ['Tooling and SaaS', 'Yearly', 'JPY tens of thousands to hundreds of thousands per year', 'Document, risk and training records'],
            ['Internal effort (labour)', 'At certification and yearly', '0.3-0.5 FTE-month per month for 6-12 months', 'The most commonly overlooked cost'],
            ['Training and awareness', 'Yearly', 'JPY tens of thousands to hundreds of thousands', 'Company-wide plus internal auditor training'],
            ['Additional technical and physical controls', 'As needed', 'JPY 0 to several million', 'Depends on the maturity of your environment'],
          ],
        },
        { type: 'h3', id: 'audit-fee', text: 'The Audit Fee Is Audit Days Multiplied by a Day Rate' },
        {
          type: 'p',
          text:
            'Certification bodies normally derive audit days from the number of people and sites inside the scope, then apply a day rate. Doubling headcount therefore does not double the fee. When you collect quotes, compare the three-year total including surveillance and recertification audits rather than the initial audit alone.',
        },
        { type: 'h3', id: 'internal-effort', text: 'Convert Hidden Internal Effort Into Money' },
        {
          type: 'p',
          text:
            'Internal effort is the line most often underestimated. Producing the information security policy, the Statement of Applicability (SoA), risk assessment procedures, and the supporting procedures and records takes real time. The full inventory is listed in [documents required for ISMS](/guide/isms-required-documents), but a realistic assumption is one owner spending 30 to 50 percent of their working hours for six to twelve months, which often converts to JPY 1M-3M of labour cost.',
        },
        { type: 'h2', id: 'cost-by-size', text: 'Benchmarks by Company Size' },
        {
          type: 'p',
          text:
            'The figures below assume a typical IT company with a single site and an in-house IT function. Treat them as ranges, since scope and existing practice change the outcome.',
        },
        {
          type: 'table',
          headers: ['Headcount', 'Initial audit fee', 'Consulting fees', 'Year-one total', 'Annual maintenance'],
          rows: [
            ['Around 10', 'JPY 400K-800K', 'JPY 1M-2M', 'JPY 1.5M-3M', 'JPY 400K-800K'],
            ['Around 30', 'JPY 600K-1.1M', 'JPY 1.5M-3M', 'JPY 2.5M-4.5M', 'JPY 600K-1.2M'],
            ['Around 100', 'JPY 900K-1.5M', 'JPY 2.5M-5M', 'JPY 4M-7M', 'JPY 1M-2M'],
          ],
        },
        {
          type: 'callout',
          title: 'Always Compare the Three-Year Total',
          text:
            'Comparing first-year cost alone leads to poor decisions. Line up year one plus two surveillance audits plus maintenance, and options that looked cheap up front often turn out to be more expensive over the cycle.',
        },
        { type: 'h2', id: 'cost-factors', text: 'Five Factors That Move the Price' },
        {
          type: 'ul',
          items: [
            '**Scope**: whole company or one business unit, and which sites are included. A wider scope means more audit days and more documentation work',
            '**Number of sites**: remote sites inside the scope add audit days and can add travel expenses',
            '**Choice of certification body**: accreditation, fee structure and auditor day rates differ, so collect several quotes',
            '**Maturity of existing practice**: if access control, logging, asset inventory and internal rules already exist, both investment and documentation effort shrink',
            '**How much you delegate to consultants**: having documents written for you versus buying review and advice can change the fee several times over',
          ],
        },
        {
          type: 'p',
          text:
            'Of these, scope and consultant dependency are the two you control most directly. Rather than covering the whole company from day one, you can certify the business or service your customers actually ask about and widen the scope later.',
        },
        { type: 'h2', id: 'cost-reduction', text: 'Five Ways to Reduce the Cost' },
        {
          type: 'ol',
          items: [
            '**Set the scope to what is necessary and sufficient**: work backwards from why customers want the certificate, and resist over-expanding',
            '**Use templates and SaaS**: starting from prepared policies, forms and risk assessment structures removes most of the blank-page effort',
            '**Grow an internal owner**: investing in internal auditor training lets you run year two onwards in house, which lowers maintenance cost',
            '**Buy consulting selectively**: use external help for risk assessment review, Statement of Applicability (SoA) validation and a mock audit before Stage 2',
            '**Check for public support schemes**: availability depends on the local government and the fiscal year, so always confirm current information for your own municipality',
          ],
        },
        {
          type: 'p',
          text:
            'On the last point, names, eligibility rules and application windows differ considerably by municipality and year. Verify eligibility against primary sources only.',
        },
        { type: 'h2', id: 'opportunity-cost', text: 'The Cost of Not Certifying' },
        {
          type: 'p',
          text:
            'A cost decision should also weigh what you lose by not certifying. Security questionnaires from enterprise buyers increasingly ask whether you hold the certificate, public sector tenders often award points for it, and SaaS procurement reviews frequently ask for third-party assurance of your information security posture.',
        },
        {
          type: 'p',
          text:
            'If a single deal is worth several million yen, losing or delaying a handful of them can outweigh the entire cost of certification. In Japan many companies also hesitate between two schemes, so reading [ISMS versus the Privacy Mark](/guide/isms-vs-privacy-mark) and confirming which one your customers actually require is the fastest way to avoid wasted spend.',
        },
        { type: 'h2', id: 'diy-feasibility', text: 'Is Certifying Without a Consultant Realistic?' },
        {
          type: 'p',
          text:
            'Nothing in the scheme requires you to hire a consultant. Where the company already has someone with hands-on information security experience, can read the standard and the Annex A controls, and can protect that person time, the consulting line can be removed entirely.',
        },
        {
          type: 'p',
          text:
            'The do-it-yourself route carries its own risks. Risk assessment procedures that do not line up with the requirements, a Statement of Applicability (SoA) that cannot justify inclusion or exclusion of controls, and internal audit or management review records that are purely formal are the classic findings raised at Stage 2. If corrective action drags the audit out, the extra cost can erase the saving.',
        },
        {
          type: 'callout',
          title: 'A Practical Rule of Thumb',
          text:
            'With an experienced practitioner in house, run the project yourself and buy external review at key points. Without one, take support for the first cycle and bring year two onwards in house. Both keep the cost-benefit balance reasonable.',
        },
        { type: 'h2', id: 'reduce-effort-with-tools', text: 'Reducing Internal Effort With Tooling' },
        {
          type: 'p',
          text:
            'As the breakdown shows, ISO 27001 cost depends far more on people hours than on audit fees. Running document version control, risk assessment records, training records and internal audit evidence out of spreadsheets and shared folders means the maintenance effort simply accumulates from year two. Keeping all of it in one managed place lowers cost in the maintenance phase, not just at certification.',
        },
        {
          type: 'p',
          text:
            'A good starting point is to understand where you stand today and where the effort is likely to concentrate. The [ISMS readiness self-check](/research) walks through a short set of questions and returns the areas worth tackling first. Articulating your internal situation before requesting quotes also makes conversations with consultants and certification bodies far more productive.',
        },
      ],
      faq: [
        {
          question: 'What is the minimum cost of ISO 27001 certification?',
          answer:
            'With around 10 employees, a single site and a tightly drawn scope, the initial audit fee can be around JPY 400,000, and a first-year total of roughly JPY 500,000 to 1 million is achievable if you run the project without a consultant. Internal staff time, which can exceed JPY 1 million in labour terms, is on top of that.',
        },
        {
          question: 'Can we certify without a consultant?',
          answer:
            'Yes. Companies with an experienced information security practitioner who can read the standard and the Annex A controls do run the project themselves. The risk is that weak risk assessment procedures or an unclear Statement of Applicability (SoA) lead to findings at Stage 2, and corrective action then extends both the timeline and the cost.',
        },
        {
          question: 'Is there a cost every year after certification?',
          answer:
            'Yes. A surveillance audit takes place each year after certification and a recertification audit in year three. Add the registration and annual administration fee, training, tooling and the internal effort for internal audit and management review, and the usual benchmark is JPY 400,000 to 2 million per year.',
        },
        {
          question: 'Which costs more, the Privacy Mark or ISO 27001?',
          answer:
            'Certification body fees are generally higher for ISO 27001. However, the Privacy Mark is limited to personal information while ISO 27001 covers information assets broadly, so rather than comparing prices directly, confirm which certificate your customers are actually asking for. The related article covers the comparison in detail.',
        },
        {
          question: 'When do the payments fall due?',
          answer:
            'Consulting fees are commonly split across contract signature and phase completions, while audit fees are usually invoiced around the Stage 1 and Stage 2 audits. Spending is concentrated in year one, so if the project crosses a fiscal year boundary it is safer to align budget approval early.',
        },
      ],
      keywords: [
        'ISO 27001 certification cost',
        'ISMS certification cost',
        'ISO 27001 audit fee',
        'ISO 27001 consulting cost',
        'ISMS maintenance cost',
        'ISO 27001 for small business',
        'ISO 27001 without a consultant',
        'ISO 27001 pricing',
      ],
    },
    zh: {
      title: 'ISMS（ISO 27001）认证费用行情｜审核、咨询与维持费用的构成与节省方法',
      metaTitle: 'ISO 27001认证费用行情｜审核·咨询·维持费',
      description:
        'ISMS（ISO 27001）认证首年费用大致为150万〜700万日元，认证后每年维持费约40万〜200万日元。本文按10人、30人、100人规模说明费用构成、影响因素以及五种降低成本的方法。',
      lead:
        '对于100人以下的日本IT企业而言，取得ISO/IEC 27001（ISMS）认证的首年费用一般在150万〜700万日元左右，认证后每年的维持费用约为40万〜200万日元。费用区间之所以很大，是因为决定总额的并非支付给认证机构的审核费用，而是咨询费用与企业内部投入的工时。本文将费用拆解为六个组成部分，给出按规模划分的参考行情、影响金额的因素，以及合理控制成本的思路。',
      blocks: [
        { type: 'h2', id: 'cost-overview', text: '把费用分成「首年」与「维持」两部分来看' },
        {
          type: 'p',
          text:
            '评估ISMS认证费用时，首先要区分**首年一次性发生的费用**与**为维持认证每年持续发生的费用**。首次注册审核分为第一阶段审核（文件审核）与第二阶段审核（现场审核），取得认证之后每年还有监督审核，每三年进行一次再认证审核。也就是说，认证并非「拿到就结束」，而应按三年周期来编制预算。审核的具体流程可参见[ISO 27001认证取得流程](/guide/iso27001-certification-process)。',
        },
        {
          type: 'p',
          text:
            '影响首年总额最大的其实不是支付给认证机构的费用。在多数企业中，咨询费用与内部负责人的工时合计占总额的六到八成。换言之，如何设计这两项，才是控制费用的核心。',
        },
        { type: 'h2', id: 'cost-breakdown', text: '费用构成｜六个组成部分' },
        {
          type: 'p',
          text:
            'ISMS认证的费用可以拆解为下列项目。所有金额均为一般性参考值，会随认证机构、适用范围与支持内容而上下浮动。',
        },
        {
          type: 'table',
          headers: ['费用项目', '发生时点', '参考区间', '备注'],
          rows: [
            ['首次注册审核（第一阶段＋第二阶段）', '取得认证时', '约40万〜150万日元', '随适用范围、人数、场所数量变动'],
            ['注册费与年度管理费', '取得时及每年', '约数万〜数十万日元', '名称与分类因认证机构而异'],
            ['监督审核', '取得次年起每年', '约为首次审核费用的三至五成', '审核工时较少，金额相对较低'],
            ['再认证审核', '每三年一次', '约为首次审核费用的六至八成', '相当于认证的重新注册'],
            ['咨询费用', '准备期间（半年〜1年）', '约100万〜500万日元', '因支持范围不同差异最大'],
            ['工具与SaaS费用', '每年', '每年约数万〜数十万日元', '文件管理、风险管理、培训记录等'],
            ['内部工时（人力成本）', '取得时及每年', '负责人每月投入0.3〜0.5人月，持续半年〜1年', '最容易被忽略的最大成本'],
            ['教育培训费', '每年', '约数万〜数十万日元', '全员培训与内部审核员培训'],
            ['技术与物理措施的追加投入', '按需', '0〜数百万日元', '取决于现有环境的成熟度'],
          ],
        },
        { type: 'h3', id: 'audit-fee', text: '审核费用由「工时（人日）×单价」决定' },
        {
          type: 'p',
          text:
            '认证机构的费用，通常是根据适用范围内的人员数量与场所数量推算出审核工时（人日），再乘以单价得出。因此员工人数翻倍并不意味着费用翻倍，增幅相对平缓。索取报价时，不应只比较首次注册审核，而应把监督审核与再认证审核合计的三年总额放在一起比较，才不会判断失误。',
        },
        { type: 'h3', id: 'internal-effort', text: '把看不见的「内部工时」折算成金额' },
        {
          type: 'p',
          text:
            '最容易被低估的是内部工时。信息安全方针、适用性声明（SoA）、风险评估程序，以及各类制度与记录的整备都需要相当的时间。所需文件的整体清单已整理在[ISMS所需文件一览](/guide/isms-required-documents)中，按一名负责人在半年至一年内投入三到五成工作时间来估算会更贴近现实，折算成人力成本达到100万〜300万日元也并不罕见。',
        },
        { type: 'h2', id: 'cost-by-size', text: '按员工规模划分的费用参考' },
        {
          type: 'p',
          text:
            '以下数字假设为单一场所、内部设有信息系统职能的一般IT企业。实际金额会因适用范围与现有运行状况而变化，请作为区间参考。',
        },
        {
          type: 'table',
          headers: ['员工规模', '首次审核费用', '咨询费用', '首年合计', '年度维持费'],
          rows: [
            ['约10人', '约40万〜80万日元', '约100万〜200万日元', '约150万〜300万日元', '约40万〜80万日元'],
            ['约30人', '约60万〜110万日元', '约150万〜300万日元', '约250万〜450万日元', '约60万〜120万日元'],
            ['约100人', '约90万〜150万日元', '约250万〜500万日元', '约400万〜700万日元', '约100万〜200万日元'],
          ],
        },
        {
          type: 'callout',
          title: '比较时请看「三年总额」',
          text:
            '只比较首年费用容易做出错误判断。把首年费用、两次监督审核与维持费用合计成三年总额并排比较，就能看清哪些初期便宜的方案实际上更贵。',
        },
        { type: 'h2', id: 'cost-factors', text: '影响费用的五个因素' },
        {
          type: 'ul',
          items: [
            '**适用范围**｜是全公司还是特定事业部，涵盖哪些场所。范围越广，审核工时与文件整备工时都会增加',
            '**场所数量**｜若异地场所被纳入范围，除审核工时外还可能产生差旅费用',
            '**认证机构的选择**｜认可体系、收费结构与审核员单价因机构而异，取得多家报价是基本做法',
            '**现有运行的成熟度**｜若制度、访问控制、日志采集与资产台账已经完备，追加投入与文件整备工时都会变小',
            '**对咨询的依赖程度**｜是请对方代为撰写全部文件，还是只接受评审与建议，费用可能相差数倍',
          ],
        },
        {
          type: 'p',
          text:
            '其中最容易由企业自身掌控的是适用范围与对咨询的依赖程度。适用范围尤其如此：不必一开始就覆盖全公司，也可以先按客户所要求的业务或服务单位取得认证，之后再逐步扩大范围。',
        },
        { type: 'h2', id: 'cost-reduction', text: '降低费用的五种方法' },
        {
          type: 'ol',
          items: [
            '**把适用范围设定得必要且充分**｜从客户要求倒推「为什么需要认证」，不要过度扩大对象',
            '**善用模板与SaaS**｜利用制度、表单与风险评估的既有框架，可大幅减少从零起草的工时',
            '**培养内部负责人**｜投入内部审核员培训等，把第二年之后的运行内制化，可降低维持费用',
            '**局部使用咨询服务**｜只在风险评估与适用性声明（SoA）的合理性评审、第二阶段审核前的模拟审核等关键处委托外部',
            '**确认是否有公共支持制度**｜可利用的制度因地方政府与年度而异，务必确认所在地的最新信息',
          ],
        },
        {
          type: 'p',
          text:
            '关于第五点，制度的名称、条件与申请时间因地方政府及年度差异很大，是否适用请务必通过一手信息确认。',
        },
        { type: 'h2', id: 'opportunity-cost', text: '不取得认证所产生的机会损失也是费用的一部分' },
        {
          type: 'p',
          text:
            '判断费用时，不仅要看支出，也要把「不取得认证会失去什么」一并列出来考虑。近年来，与大型企业开始交易时的安全检查表会询问是否持有认证，政府与地方公共团体的投标资格中认证常被列为加分项，SaaS采购审查中也越来越多地要求提供信息安全体制的第三方证明。',
        },
        {
          type: 'p',
          text:
            '如果单笔业务的成交规模超过数百万日元，仅仅因为没有认证而丢单或让商谈周期拉长几次，损失就可能超过取得认证的费用。在日本国内，很多企业还会在两种制度之间犹豫，可参考[ISMS与隐私标志的比较](/guide/isms-vs-privacy-mark)，先确认客户真正要求的是哪一种，这是避免无谓支出的最短路径。',
        },
        { type: 'h2', id: 'diy-feasibility', text: '「自行取得认证」是否现实' },
        {
          type: 'p',
          text:
            '在制度上，不聘请咨询顾问、仅依靠自身力量取得认证是可行的。如果公司内部已有具备信息安全实务经验的人员，能够读懂标准正文与附录A的控制措施，并且负责人能够确保一定的投入时间，那么咨询费用这一项可以整体压缩。',
        },
        {
          type: 'p',
          text:
            '另一方面，自行应对也有其特有的风险。风险评估程序与标准要求不吻合、适用性声明（SoA）无法说明控制措施的采用与排除理由、内部审核与管理评审的记录流于形式，都是第二阶段审核中容易被指出的典型不符合项。若纠正措施导致审核周期拉长而产生追加费用，最终未必真的省钱。',
        },
        {
          type: 'callout',
          title: '判断的参考基准',
          text:
            '公司内部有信息安全实务经验者，可以由自己主导并只在关键处接受外部评审；如果没有，则在首个周期接受支持、从第二年起转为内制化。这两种组合在成本效益上都比较均衡。',
        },
        { type: 'h2', id: 'reduce-effort-with-tools', text: '用工具减少内部工时的思路' },
        {
          type: 'p',
          text:
            '如前所述，ISMS认证的费用更多取决于「人投入的时间」，而非审核费用本身。若用Excel与共享文件夹来处理文件版本管理、风险评估记录、培训实施记录与内部审核证据，第二年之后的维持工时就会不断累积。把这些内容集中管理，不仅能降低首年成本，也能持续压低维持阶段的费用。',
        },
        {
          type: 'p',
          text:
            '有效的起点是先弄清自身目前处于哪个阶段、工时可能集中在哪里。通过[ISMS现状自查](/research)，只需回答若干问题，就能梳理出当前应优先着手的领域。在索取报价之前先把内部状况表述清楚，与咨询顾问及认证机构的沟通也会更顺畅。',
        },
      ],
      faq: [
        {
          question: 'ISMS认证的费用最低需要多少？',
          answer:
            '若为约10人规模、单一场所且适用范围较小的构成，首次审核费用可能在40万日元左右；不聘请咨询顾问、完全自行应对时，首年总额有时可控制在50万〜100万日元左右。但内部负责人的工时（折算人力成本有时超过100万日元）需另行计算。',
        },
        {
          question: '不请咨询顾问能取得认证吗？',
          answer:
            '在制度上是可行的。如果公司内部有具备信息安全实务经验的人员，能够读懂标准正文与附录A的控制措施，确实有企业依靠自身力量完成。但若风险评估程序或适用性声明（SoA）的说明不充分，在第二阶段审核中容易被指出不符合项，纠正措施会使周期与费用膨胀。',
        },
        {
          question: '维持费用是每年都会发生吗？',
          answer:
            '是的。取得认证的次年起每年都有监督审核，第三年进行再认证审核。再加上注册费与年度管理费、教育培训费、工具费用，以及内部审核与管理评审的工时，一般每年约为40万〜200万日元。',
        },
        {
          question: '隐私标志与ISMS认证哪个费用更高？',
          answer:
            '一般来说，支付给认证机构的费用水平以ISMS认证更高。不过隐私标志的对象仅限于个人信息保护，而ISMS认证涵盖信息资产整体，因此比起单纯比较金额，更重要的是确认客户所要求的究竟是哪一种认证。详细内容请参见相关文章。',
        },
        {
          question: '费用在什么时候支付？',
          answer:
            '咨询费用多为签约时与各阶段完成时分期支付，审核费用一般在第一阶段审核与第二阶段审核实施前后开具账单。首年支出较为集中，若项目跨越会计年度，建议提前调整预算编列的时间。',
        },
      ],
      keywords: [
        'ISMS认证 费用',
        'ISO 27001 取得费用',
        'ISMS 费用 行情',
        '审核费用',
        '咨询费用',
        '维持费用',
        '中小企业',
        '自行取得认证',
      ],
    },
  },
};
