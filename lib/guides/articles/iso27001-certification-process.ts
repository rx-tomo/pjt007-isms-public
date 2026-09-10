import type { GuideArticle } from '../types';

export const iso27001CertificationProcess: GuideArticle = {
  slug: 'iso27001-certification-process',
  publishedAt: '2026-09-10',
  updatedAt: '2026-09-10',
  related: ['isms-certification-cost', 'isms-risk-assessment', 'isms-required-documents'],
  content: {
    ja: {
      title: 'ISO27001（ISMS）認証取得の流れと期間｜キックオフから登録までの8ステップ',
      metaTitle: 'ISO27001取得の流れと期間｜8ステップで解説',
      description:
        'ISO27001（ISMS）認証取得の流れを、体制づくりから登録までの8ステップで解説。一般的な期間は6〜12か月程度です。リスクアセスメント、内部監査、第一段階・第二段階審査の要点と月別スケジュール例をまとめました。',
      lead: 'ISO/IEC 27001（ISMS）の認証取得は、一般的にキックオフから登録まで6〜12か月程度をかけて進めます。全体は「体制と適用範囲を決める → リスクを評価して対策を決める → 文書化して運用する → 内部監査とマネジメントレビューで自己点検する → 審査機関の第一段階・第二段階審査を受ける」という一本道です。この記事では、何から始めるか、各ステップで何を残すか、どこで時間を使うかを順に整理します。',
      blocks: [
        { type: 'h2', id: 'overview-and-duration', text: '取得までの全体像と期間の目安' },
        {
          type: 'p',
          text: 'ISO/IEC 27001 の認証取得は、**適用範囲（スコープ）の決定**から始まり、リスクアセスメント、文書化、運用、内部監査、マネジメントレビューを経て第一段階審査・第二段階審査へ進みます。〜100名規模のIT企業では、キックオフから登録まで**6〜12か月程度**を見込む例が多く、社内規程やセキュリティ運用が整っている組織ほど短く収まります。',
        },
        {
          type: 'p',
          text: '期間を左右する最大の要因は、文書の量ではなく**運用実績（記録）の蓄積**です。審査では規程どおり運用されているかを記録で確認するため、一般的には文書整備後に最低3か月程度の運用期間を置いて審査に臨みます。費用は[ISMS認証取得の費用](/guide/isms-certification-cost)もご確認ください。',
        },
        {
          type: 'callout',
          title: '何から始めるか迷ったら',
          text: '最初にやるべきは文書作成ではなく、**経営層の合意と適用範囲の決定**です。組織・拠点・サービス・情報資産の境界が決まらないと、リスクアセスメントの対象も必要な規程の範囲も確定しません。曖昧なまま走ると後工程で手戻りが発生します。',
        },
        { type: 'h2', id: 'pdca-and-clauses', text: 'PDCAとISO/IEC 27001:2022 箇条4〜10の対応' },
        {
          type: 'p',
          text: 'ISO/IEC 27001:2022 の要求事項は箇条4から箇条10で構成され、そのままPDCAサイクルに対応します。工程表をこの構造に沿って組み立てると抜け漏れが起きにくくなります。',
        },
        {
          type: 'ul',
          items: [
            'Plan（計画）— 箇条4「組織及びその状況の理解」、箇条5「リーダーシップ」、箇条6「計画」。適用範囲、情報セキュリティ方針、リスクアセスメントとリスク対応、適用宣言書（SoA）、情報セキュリティ目的。',
            'Do（実行）— 箇条7「支援」、箇条8「運用」。力量・認識（教育）、文書化した情報の管理、日々の運用と記録の作成。',
            'Check（点検）— 箇条9「パフォーマンス評価」。監視・測定・分析・評価、内部監査、マネジメントレビューの3点で自己点検します。',
            'Act（改善）— 箇条10「改善」。不適合及び是正処置と継続的改善。監査や審査の指摘をここで閉じます。',
          ],
        },
        {
          type: 'p',
          text: '附属書Aの管理策（2022年版では**組織的・人的・物理的・技術的**の4テーマ、93項目）は、箇条6のリスクアセスメント結果から適用要否を判断します。その判断と根拠を一覧にした**適用宣言書（SoA）**は審査で必ず確認される中心的な文書です。詳しくは[ISMSリスクアセスメントの進め方](/guide/isms-risk-assessment)をご覧ください。',
        },
        { type: 'h2', id: 'eight-steps', text: 'キックオフから登録までの8ステップ' },
        {
          type: 'ol',
          items: [
            '**体制構築・適用範囲の決定** — 経営層の承認、推進責任者と事務局の任命、対象組織・拠点・サービス・情報資産の境界確定、情報セキュリティ方針の制定。',
            '**ギャップ分析** — 現状の社内ルールと運用を箇条4〜10および附属書Aの管理策と突き合わせ、不足を一覧化します。この不足リストがそのままタスクリストになります。',
            '**リスクアセスメントとリスク対応計画・適用宣言書（SoA）** — 情報資産を洗い出し、機密性・完全性・可用性の観点でリスクを特定・分析・評価し、受容基準に照らして対応方針（低減・回避・移転・保有）を決めSoAにまとめます。',
            '**文書化** — 方針、各種規程（アクセス管理、資産管理、委託先管理、事業継続、インシデント対応など）、手順書、様式を整備します。既存ルールを土台に、実際に守れる粒度で書きます。全体像は[ISMSで必要な文書一覧](/guide/isms-required-documents)を参照してください。',
            '**運用と記録の蓄積** — 規程を実際に回し、教育記録、資産管理台帳の更新、アクセス権の付与・棚卸し記録、委託先評価、インシデント記録などの証跡を残します。一般的に最低3か月程度が目安とされます。',
            '**内部監査** — 監査計画を立て、独立性を確保した監査員が全要求事項と適用した管理策をカバーして実施します。指摘は是正処置として記録し、期限を切って閉じます。',
            '**マネジメントレビュー** — 内部監査結果、リスクの変化、目的の達成状況、インシデント、利害関係者の意見を経営層に報告し、資源配分と改善方針を決めて議事録に残します。',
            '**審査機関の選定・申請と受審** — 認定を受けた審査機関へ申請し、第一段階審査（文書審査）と第二段階審査（運用審査）を受けます。指摘には是正処置を提出し、判定を経て登録に至ります。',
          ],
        },
        { type: 'h2', id: 'stage-audits', text: '第一段階審査と第二段階審査で見られること' },
        { type: 'h3', id: 'stage-one-audit', text: '第一段階審査（文書審査）' },
        {
          type: 'p',
          text: '文書体系が要求事項を満たしているか、適用範囲とSoAの整合が取れているか、第二段階審査の準備状況かを確認します。方針、リスクアセスメントの手順と結果、SoA、内部監査とマネジメントレビューの記録が主な対象です。準備不足なら日程を後ろへ調整するのが一般的です。',
        },
        { type: 'h3', id: 'stage-two-audit', text: '第二段階審査（運用審査）' },
        {
          type: 'p',
          text: '現場でのインタビューと記録の確認により、文書どおりに運用されているかを見ます。入退室記録、アクセス権の棚卸し、教育記録、委託先評価、脆弱性・インシデント対応の履歴など実際の証跡が対象です。指摘は重大度で区分され、是正処置計画または完了報告を提出して登録判定へ進みます。',
        },
        {
          type: 'callout',
          title: '指摘は失敗ではありません',
          text: '審査での指摘は珍しくなく、是正処置を通じて改善する仕組みそのものがISMSの中核です。重要なのは根本原因を特定し、再発しない形で手順や記録の運用に反映することです。',
        },
        { type: 'h2', id: 'schedule-example', text: '月別スケジュール例（10か月モデル）' },
        {
          type: 'p',
          text: '社員50〜100名程度のIT企業が外部支援を部分的に使って進める場合の一例です。組織の状況で前後するため、自社に置き換えて調整してください。',
        },
        {
          type: 'table',
          headers: ['時期', '主な作業', '残す成果物・記録'],
          rows: [
            ['1か月目', 'キックオフ、体制構築、適用範囲の決定', '経営層承認記録、体制図、情報セキュリティ方針'],
            ['2か月目', 'ギャップ分析、取得計画の確定', 'ギャップ分析結果、タスク一覧、全体スケジュール'],
            ['3〜4か月目', '情報資産の洗い出し、リスクアセスメント、リスク対応計画、SoA', '情報資産台帳、リスク管理表、リスク対応計画、SoA'],
            ['4〜5か月目', '規程・手順書・様式の整備、経営層承認', '文書一覧、各規程・手順書、承認記録'],
            ['6〜8か月目', '全社教育、規程に沿った運用開始、証跡の蓄積', '教育実施記録、権限棚卸し記録、委託先評価、インシデント記録'],
            ['8か月目', '内部監査員の育成、内部監査の実施', '内部監査計画・報告書、是正処置記録'],
            ['9か月目', 'マネジメントレビュー、審査機関への申請', 'マネジメントレビュー議事録、申請書類'],
            ['9〜10か月目', '第一段階審査→是正→第二段階審査→是正→登録', '審査報告書、是正処置報告、登録証'],
          ],
        },
        {
          type: 'p',
          text: '審査機関の選定と申請は**第一段階審査の3〜4か月前**に着手すると日程調整に余裕が生まれます。繁忙期は希望日が取りにくいため、運用開始と並行して見積り依頼を進めるのが現実的です。',
        },
        { type: 'h2', id: 'common-pitfalls', text: 'よくあるつまずき4つ' },
        {
          type: 'ul',
          items: [
            '**適用範囲を広げすぎる** — 初回から全社・全拠点・全サービスを対象にすると、資産の洗い出しも規程整備も証跡集めも一気に膨らみます。まず主要サービスと本社に絞り、更新審査で拡大する進め方も選択肢です。',
            '**文書を作って終わりにする** — テンプレートを埋めただけの規程は実態と乖離しがちです。第二段階審査で見られるのは文書ではなく、そのとおりに動いた記録です。書いた本人以外が実行できるかを基準に粒度を決めます。',
            '**記録が残っていない** — 実施しているのに日付・実施者・対象・結果が残っていない例は非常に多いです。教育、権限棚卸し、委託先評価、バックアップ確認などは実施と同時に記録します。',
            '**内部監査が形骸化する** — チェックリストに丸を付けるだけでは指摘がゼロになり改善が回りません。監査員の独立性を確保し、記録の実物をサンプリング確認します。',
          ],
        },
        { type: 'h2', id: 'after-certification', text: '認証後の運用：サーベイランス審査と更新審査' },
        {
          type: 'p',
          text: '認証は取得して終わりではなく、維持のための審査が続きます。一般的には登録後おおむね1年ごとに**サーベイランス審査（維持審査）**、**3年ごとに更新審査（再認証審査）**を受ける形が広く採られています。サーベイランス審査は範囲を絞って行われる一方、内部監査とマネジメントレビューは毎年必要です。',
        },
        {
          type: 'p',
          text: 'つまり取得プロジェクトで作った運用サイクルは、毎年回し続ける前提で設計する必要があります。特定の担当者の手作業に依存していると、2年目以降に負担が跳ね上がります。',
        },
        { type: 'h2', id: 'manage-with-tools', text: 'ツールで進捗と証跡を一元管理する' },
        {
          type: 'p',
          text: '取得プロジェクトでは、情報資産台帳、リスク管理表、SoA、規程の版管理、教育の受講状況、内部監査の指摘と是正、マネジメントレビュー議事録と扱う情報が多岐にわたります。これらを分散管理すると、どこまで進んだか・どの証跡が足りないかが見えなくなります。リスク・管理策・文書・記録を紐づけて管理すれば、進捗と不足がその場で分かり、翌年以降の維持も同じ仕組みで回せます。',
        },
        {
          type: 'p',
          text: '自社が今どの段階にいるか、次に何から着手すべきかを整理したい場合は、[ISMS現在地セルフチェック](/research)から始めてみてください。',
        },
      ],
      faq: [
        {
          question: 'ISO27001の取得は最短でどのくらいかかりますか。',
          answer:
            '組織の規模や既存のルール整備状況によりますが、一般的には6か月程度からという例が多く見られます。文書整備だけを急いでも、運用の記録が一定期間分そろっていなければ第二段階審査で確認できる証跡が不足します。一般的に最低3か月程度の運用期間が目安とされるため、そこを起点に逆算するのが現実的です。',
        },
        {
          question: '小規模な会社でも取得できますか。',
          answer:
            '従業員数が少ない組織でも取得は可能です。ISO/IEC 27001の要求事項は組織の規模に応じて適用の仕方を調整できるため、数名規模でも適用範囲とリスクに見合った文書と運用であれば問題ありません。ただし内部監査の独立性を確保する必要があるため、監査対象業務を担当していない人を監査員に充てるか、外部の監査員を活用する工夫が必要になります。',
        },
        {
          question: '審査は何回受けるのですか。',
          answer:
            '初回の認証取得では、文書と準備状況を見る第一段階審査と、運用状況を見る第二段階審査の2回を受けるのが一般的です。指摘があれば是正処置を提出し、必要に応じて確認が行われます。登録後はおおむね年1回のサーベイランス審査と、3年ごとの更新審査が続きます。',
        },
        {
          question: 'コンサルタントを使わず自社だけで進められますか。',
          answer:
            '自社のみで進める企業もあります。判断材料になるのは、規格の要求事項を読み解ける担当者がいるか、内部監査員を育成できるか、プロジェクトに割ける工数があるかの3点です。全面的に外部へ委託せず、ギャップ分析と内部監査だけ外部の力を借りるといった部分的な使い方も一般的です。いずれの場合も、運用と記録を担うのは自社である点は変わりません。',
        },
        {
          question: '取得前に社内で最初に決めておくべきことは何ですか。',
          answer:
            '適用範囲（対象の組織・拠点・サービス）と、取得の目的・希望時期、そして推進体制の3つです。特に適用範囲は、リスクアセスメントの対象範囲、必要な規程、審査工数のすべてに影響します。取引先要件や入札要件が動機の場合は、求められている範囲を先に確認しておくと手戻りを避けられます。',
        },
      ],
      keywords: [
        'ISO27001 取得 流れ',
        'ISMS 認証取得 手順',
        'ISO27001 取得 期間',
        'ISMS スケジュール',
        '第一段階審査',
        '第二段階審査',
        '内部監査',
        'マネジメントレビュー',
        '適用宣言書',
      ],
    },
    en: {
      title: 'The ISO 27001 (ISMS) Certification Process and Timeline: 8 Steps from Kickoff to Registration',
      metaTitle: 'ISO 27001 Certification Process and Timeline: 8 Steps',
      description:
        'ISO 27001 (ISMS) certification in eight steps from kickoff to registration, why it usually takes 6 to 12 months, and what Stage 1 and Stage 2 audits check.',
      lead: 'Getting certified to ISO/IEC 27001 generally takes six to twelve months from kickoff to registration. The path is a straight line: define your team and scope, assess risk and decide on controls, document and operate the system, check yourself through internal audit and management review, then go through the Stage 1 and Stage 2 audits with a certification body. This guide walks through where to start, what evidence to keep at each step, and where the time actually goes.',
      blocks: [
        { type: 'h2', id: 'overview-and-duration', text: 'The Full Picture and How Long It Takes' },
        {
          type: 'p',
          text: 'ISO/IEC 27001 certification starts with **defining the scope**, then moves through risk assessment, documentation, operation, internal audit and management review, and finally the Stage 1 and Stage 2 audits performed by a certification body. For IT companies of up to roughly 100 people, a **six to twelve month** timeline is common, and organisations that already have internal rules and security practices in place tend to land at the shorter end.',
        },
        {
          type: 'p',
          text: 'The biggest factor is not the volume of documents but the **accumulation of operating records**. Auditors confirm through records that the system is being run the way the documents say, so it is common practice to allow at least around three months of operation after the documents are in place before going to audit. For budgeting, see [the cost of ISMS certification](/guide/isms-certification-cost).',
        },
        {
          type: 'callout',
          title: 'If You Are Wondering Where to Start',
          text: 'The first move is not writing documents. It is **securing top management commitment and fixing the scope**. Until the boundary of organisations, sites, services and information assets is settled, you cannot fix the target of the risk assessment, the range of policies you need, or the audit effort estimate. Running ahead with a vague scope leads to rework across the whole project.',
        },
        { type: 'h2', id: 'pdca-and-clauses', text: 'PDCA and Clauses 4 to 10 of ISO/IEC 27001:2022' },
        {
          type: 'p',
          text: 'The requirements of ISO/IEC 27001:2022 sit in clauses 4 through 10 and map directly onto the PDCA cycle. Building your project plan along this structure makes gaps much easier to spot.',
        },
        {
          type: 'ul',
          items: [
            'Plan — Clause 4 (context of the organisation), Clause 5 (leadership) and Clause 6 (planning). Scope, the information security policy, risk assessment and risk treatment, the Statement of Applicability (SoA), and information security objectives all live here.',
            'Do — Clause 7 (support) and Clause 8 (operation). Competence and awareness, communication, control of documented information, and the day-to-day operation that produces records.',
            'Check — Clause 9 (performance evaluation). Monitoring and measurement, internal audit, and management review form the self-check set.',
            'Act — Clause 10 (improvement). Nonconformity and corrective action, plus continual improvement. Findings from internal audits and external audits are closed here.',
          ],
        },
        {
          type: 'p',
          text: 'The Annex A controls, organised in the 2022 edition into four themes (**organizational, people, physical and technological**, 93 controls in total), are selected on the basis of the Clause 6 risk assessment. The document listing those decisions and their justification is the **Statement of Applicability (SoA)**, which auditors always examine. For the mechanics of assessing risk, see [how to run an ISMS risk assessment](/guide/isms-risk-assessment).',
        },
        { type: 'h2', id: 'eight-steps', text: 'Eight Steps from Kickoff to Registration' },
        {
          type: 'ol',
          items: [
            '**Build the team and define the scope** — Obtain management approval, appoint an ISMS lead and a working group, fix the boundary of organisations, sites, services and information assets, and issue the information security policy.',
            '**Gap analysis** — Compare current internal rules and practices against clauses 4 to 10 and the Annex A controls, and list what is missing. That list becomes your task backlog.',
            '**Risk assessment, risk treatment plan and SoA** — Inventory information assets, identify, analyse and evaluate risks in terms of confidentiality, integrity and availability, decide treatment options against your acceptance criteria, and record the control decisions in the SoA.',
            '**Documentation** — Prepare the policy, supporting policies and procedures (access control, asset management, supplier management, business continuity, incident response and so on) and the forms that go with them. Build on the rules you already have, and write at a level people can actually follow. See [the ISMS document list](/guide/isms-required-documents) for the overall picture.',
            '**Operate and accumulate records** — Actually run the system. Keep training records, asset inventory updates, access rights granting and review records, supplier evaluations, incident records and change records. Around three months of operation is a commonly cited minimum.',
            '**Internal audit** — Plan the audit and have auditors with sufficient independence cover all requirements and the applied controls. Log findings as corrective actions and close them against a deadline.',
            '**Management review** — Report internal audit results, changes in risk, progress against objectives, incidents and interested party feedback to top management, decide on resources and improvement direction, and minute the outcome.',
            '**Select a certification body, apply and be audited** — Apply to an accredited certification body, undergo the Stage 1 audit (documentation) and the Stage 2 audit (operation), submit corrective actions for any findings, and proceed through the certification decision to registration.',
          ],
        },
        { type: 'h2', id: 'stage-audits', text: 'What Stage 1 and Stage 2 Audits Look At' },
        { type: 'h3', id: 'stage-one-audit', text: 'Stage 1 Audit (Documentation Review)' },
        {
          type: 'p',
          text: 'This audit confirms that the documented ISMS meets the requirements, that the scope and the SoA are consistent, and that you are ready for Stage 2. The policy, the risk assessment method and results, the SoA, and the internal audit and management review records are the main items examined. If readiness gaps come up here, moving the Stage 2 date back is a common outcome.',
        },
        { type: 'h3', id: 'stage-two-audit', text: 'Stage 2 Audit (Operational Audit)' },
        {
          type: 'p',
          text: 'Through interviews on site and inspection of records, this audit checks whether the system is run as documented. Physical access logs, access rights reviews, training records, supplier evaluations, and vulnerability and incident handling histories are all examined as actual evidence. Findings are classified by severity, and depending on the classification you submit either a corrective action plan or evidence of completed correction before the certification decision.',
        },
        {
          type: 'callout',
          title: 'Findings Are Not Failures',
          text: 'Findings at audit are ordinary, and the mechanism of improving through corrective action is the core of an ISMS. What matters is identifying the root cause and reflecting it in procedures and record-keeping so the same issue does not recur.',
        },
        { type: 'h2', id: 'schedule-example', text: 'A Month-by-Month Schedule (10-Month Model)' },
        {
          type: 'p',
          text: 'This example assumes an IT company of roughly 50 to 100 people using partial external support. Adjust it to your own situation, since timings shift with the state of the organisation.',
        },
        {
          type: 'table',
          headers: ['Timing', 'Main activities', 'Deliverables and records to keep'],
          rows: [
            ['Month 1', 'Kickoff, team setup, scope definition', 'Management approval record, org chart, information security policy'],
            ['Month 2', 'Gap analysis, project plan finalisation', 'Gap analysis results, task list, master schedule'],
            ['Months 3-4', 'Asset inventory, risk assessment, risk treatment plan, SoA', 'Asset inventory, risk register, risk treatment plan, SoA'],
            ['Months 4-5', 'Drafting policies, procedures and forms; management approval', 'Document register, policies and procedures, approval records'],
            ['Months 6-8', 'Company-wide training, start of operation, evidence accumulation', 'Training records, access rights review records, supplier evaluations, incident records'],
            ['Month 8', 'Internal auditor training, internal audit', 'Audit plan, checklist and report, corrective action records'],
            ['Month 9', 'Management review, application to a certification body', 'Management review minutes, application documents'],
            ['Months 9-10', 'Stage 1 audit, correction, Stage 2 audit, correction, registration', 'Audit reports, corrective action reports, certificate'],
          ],
        },
        {
          type: 'p',
          text: 'Starting the selection of and application to a certification body **three to four months before the Stage 1 audit** gives you room to negotiate dates. Busy seasons make preferred dates hard to secure, so requesting quotes in parallel with the start of operation is a practical approach.',
        },
        { type: 'h2', id: 'common-pitfalls', text: 'Four Common Stumbling Blocks' },
        {
          type: 'ul',
          items: [
            '**Setting the scope too wide** — Covering every entity, site and service on the first attempt inflates the asset inventory, the documentation work and the evidence gathering all at once. Narrowing to the main service and head office first, and expanding at recertification, is a legitimate option.',
            '**Treating documentation as the finish line** — Policies produced by filling in a template tend to drift from what people actually do. Stage 2 looks at records of the system running, not at the documents themselves. Write at a level someone other than the author can execute.',
            '**Doing the work but keeping no records** — It is very common for activities to happen without the date, the person responsible, the target and the outcome being recorded. Training, access rights reviews, supplier evaluations and backup checks should be recorded at the moment they are performed.',
            '**Internal audit as a formality** — An audit that only ticks boxes produces zero findings and no improvement. Secure auditor independence and sample the actual records.',
          ],
        },
        { type: 'h2', id: 'after-certification', text: 'After Certification: Surveillance and Recertification Audits' },
        {
          type: 'p',
          text: 'Certification is not the end point, because maintenance audits continue. Commonly, a **surveillance audit** takes place roughly once a year after registration, and a **recertification audit every three years**. Surveillance audits are often narrower in scope than the initial audit, but internal audit and management review still need to be carried out every year.',
        },
        {
          type: 'p',
          text: 'In other words, the operating cycle you build during the certification project should be designed on the assumption that it runs every year. If evidence collection depends on one person doing it by hand, the burden rises sharply from the second year and records start going missing.',
        },
        { type: 'h2', id: 'manage-with-tools', text: 'Keeping Progress and Evidence in One Place' },
        {
          type: 'p',
          text: 'A certification project touches the asset inventory, the risk register, the SoA, document version control, training completion, internal audit findings and corrective actions, and management review minutes. Spreading all of that across spreadsheets and shared folders makes it hard to see how far along you are and which evidence is missing, and the gap shows up as a scramble just before the audit. Linking risks, controls, documents and records inside a single tool makes progress and gaps visible on the spot, and lets you run maintenance the same way in later years.',
        },
        {
          type: 'p',
          text: 'If you want to work out which stage you are at and what to tackle next, start with the [ISMS readiness self-check](/research).',
        },
      ],
      faq: [
        {
          question: 'What is the shortest realistic timeline for ISO 27001?',
          answer:
            'It depends on your size and on how developed your existing rules are, but around six months is a commonly seen floor. Rushing the documentation alone does not help, because without a period of operating records there is not enough evidence for the Stage 2 audit. Since roughly three months of operation is generally treated as a minimum, work backwards from that.',
        },
        {
          question: 'Can a small company get certified?',
          answer:
            'Yes. The requirements of ISO/IEC 27001 can be applied proportionally to the size of the organisation, so a handful of people can be certified with documentation and operation that match the scope and the risks. The one point that needs attention is the independence of the internal audit: assign auditors who do not work on the activities being audited, or bring in an external auditor.',
        },
        {
          question: 'How many audits are there?',
          answer:
            'For initial certification it is usually two: the Stage 1 audit covering documentation and readiness, and the Stage 2 audit covering operation. Corrective actions are submitted for any findings and verified as needed. After registration, surveillance audits roughly once a year and a recertification audit every three years follow.',
        },
        {
          question: 'Can we do this in-house without a consultant?',
          answer:
            'Some companies do. The deciding factors are whether someone can interpret the requirements, whether you can train internal auditors, and whether you have the hours to spend. Partial use of external help, for example for the gap analysis and the internal audit only, is also common. In every case, operating the system and keeping the records remains your own job.',
        },
        {
          question: 'What should we decide internally before we start?',
          answer:
            'Three things: the scope (which organisations, sites and services), the reason for certifying and the target date, and who runs the project. Scope in particular drives the risk assessment, the policies you need and the audit effort. If a customer or tender requirement is the motivation, confirm the required scope first to avoid rework.',
        },
      ],
      keywords: [
        'ISO 27001 certification process',
        'ISMS certification steps',
        'ISO 27001 timeline',
        'ISMS implementation schedule',
        'Stage 1 audit',
        'Stage 2 audit',
        'internal audit',
        'management review',
        'Statement of Applicability',
      ],
    },
    zh: {
      title: 'ISO 27001（ISMS）认证的流程与周期｜从启动到注册的8个步骤',
      metaTitle: 'ISO 27001认证流程与周期｜8个步骤详解',
      description:
        '详解ISO 27001（ISMS）认证从启动到注册的8个步骤，通常周期为6至12个月。涵盖适用范围确定、风险评估、内部审核、管理评审，以及第一阶段审核与第二阶段审核的要点和月度进度示例。',
      lead: 'ISO/IEC 27001（ISMS）认证通常需要6至12个月，从项目启动到取得注册。整体路径是一条直线：确定组织与适用范围，评估风险并决定控制措施，编制文件并实际运行，通过内部审核与管理评审进行自查，最后接受认证机构的第一阶段审核与第二阶段审核。本文按顺序说明从何开始、每一步要留下什么记录、时间主要花在哪里。',
      blocks: [
        { type: 'h2', id: 'overview-and-duration', text: '认证的整体流程与周期参考' },
        {
          type: 'p',
          text: 'ISO/IEC 27001 认证从**确定适用范围**开始，依次经过风险评估、文件编制、体系运行、内部审核与管理评审，最后接受认证机构的第一阶段审核与第二阶段审核。对于100人以内的IT企业，从启动到注册通常需要**6至12个月**；内部规章与安全运维基础较好的组织，往往可以落在较短的一端。',
        },
        {
          type: 'p',
          text: '影响周期的最大因素不是文件的数量，而是**运行记录的积累**。审核通过记录确认体系是否按文件要求实际运行，因此通常做法是在文件齐备后再留出至少约3个月的运行期再安排审核。关于费用可参考[ISMS认证的费用](/guide/isms-certification-cost)。',
        },
        {
          type: 'callout',
          title: '不知道从哪里开始时',
          text: '第一步不是编写文件，而是**取得管理层承诺并确定适用范围**。在组织、场所、服务与信息资产的边界确定之前，风险评估的对象、所需制度的范围、审核工作量的估算都无法确定。范围模糊就推进，后续环节容易出现全面返工。',
        },
        { type: 'h2', id: 'pdca-and-clauses', text: 'PDCA与ISO/IEC 27001:2022 第4至10章的对应' },
        {
          type: 'p',
          text: 'ISO/IEC 27001:2022 的要求由第4章至第10章构成，可直接对应PDCA循环。按照这一结构编制项目计划，更不容易出现遗漏。',
        },
        {
          type: 'ul',
          items: [
            'Plan（策划）— 第4章“组织环境”、第5章“领导作用”、第6章“策划”。适用范围、信息安全方针、风险评估与风险处置、适用性声明（SoA）、信息安全目标都在这里。',
            'Do（实施）— 第7章“支持”、第8章“运行”。能力与意识（培训）、沟通、成文信息的控制，以及日常运行与记录的产生。',
            'Check（检查）— 第9章“绩效评价”。监视测量分析评价、内部审核、管理评审构成自查三件套。',
            'Act（改进）— 第10章“改进”。不符合与纠正措施，以及持续改进。内部审核与外部审核提出的问题在这里闭环。',
          ],
        },
        {
          type: 'p',
          text: '附录A的控制措施（2022版分为**组织、人员、物理、技术**四个主题，共93项）依据第6章的风险评估结果确定是否适用。记录这些判定及其理由的文件即**适用性声明（SoA）**，是审核必查的核心文件。风险评估的具体做法请见[ISMS风险评估的推进方法](/guide/isms-risk-assessment)。',
        },
        { type: 'h2', id: 'eight-steps', text: '从启动到注册的8个步骤' },
        {
          type: 'ol',
          items: [
            '**建立组织体系、确定适用范围** — 取得管理层批准，任命ISMS负责人与工作组，确定组织、场所、服务与信息资产的边界，发布信息安全方针。',
            '**差距分析** — 将现有内部规章与实际做法同第4至10章要求及附录A控制措施逐条对照，列出不足。该清单即为后续任务清单。',
            '**风险评估、风险处置计划与适用性声明（SoA）** — 梳理信息资产，从保密性、完整性、可用性角度识别、分析、评价风险，依据接受准则确定处置方式，并汇总为SoA。',
            '**文件编制** — 编制信息安全方针、各项制度（访问控制、资产管理、供方管理、业务连续性、事件响应等）、作业程序与表单。以现有内部规章为基础，写到员工能够实际执行的颗粒度。所需文件全貌可参考[ISMS所需文件清单](/guide/isms-required-documents)。',
            '**体系运行与记录积累** — 实际按制度运行，留下培训记录、资产台账更新、访问权限授予与复核记录、供方评价、事件记录、变更记录等证据。通常认为至少需要约3个月的运行期。',
            '**内部审核** — 制定审核计划，由具备独立性的审核员覆盖全部要求与已适用的控制措施实施审核。发现的问题作为纠正措施记录，并设定期限闭环。',
            '**管理评审** — 将内部审核结果、风险变化、目标达成情况、安全事件、相关方意见等报告管理层，决定资源投入与改进方向，并形成会议记录。',
            '**选择认证机构、提交申请并接受审核** — 向获得认可的认证机构提交申请，接受第一阶段审核（文件审核）与第二阶段审核（运行审核），对提出的问题提交纠正措施，经认证决定后取得注册。',
          ],
        },
        { type: 'h2', id: 'stage-audits', text: '第一阶段审核与第二阶段审核关注什么' },
        { type: 'h3', id: 'stage-one-audit', text: '第一阶段审核（文件审核）' },
        {
          type: 'p',
          text: '该审核确认成文的ISMS是否满足标准要求、适用范围与SoA是否一致、是否具备接受第二阶段审核的条件。方针、风险评估方法与结果、SoA、内部审核与管理评审记录是主要检查对象。若在此发现准备不足，通常会将第二阶段审核的日程后移。',
        },
        { type: 'h3', id: 'stage-two-audit', text: '第二阶段审核（运行审核）' },
        {
          type: 'p',
          text: '该审核通过现场访谈与记录核查，确认体系是否按文件实际运行。出入记录、访问权限复核、培训实施记录、供方评价、漏洞处理与事件响应履历等实际证据都会被查阅。发现的问题按严重程度分类，视情况提交纠正措施计划或纠正完成报告，经认证机构确认后进入认证决定。',
        },
        {
          type: 'callout',
          title: '被提出问题并不等于失败',
          text: '审核中被提出问题是很常见的，通过纠正措施持续改进的机制本身就是ISMS的核心。关键在于找到根本原因，并把改进落到程序与记录的日常运行中，使同样的问题不再发生。',
        },
        { type: 'h2', id: 'schedule-example', text: '月度进度示例（10个月模型）' },
        {
          type: 'p',
          text: '以下是50至100人规模的IT企业、部分借助外部支持推进时的一个示例。实际时间会随组织情况前后浮动，请结合自身情况调整。',
        },
        {
          type: 'table',
          headers: ['时间', '主要工作', '需留存的成果与记录'],
          rows: [
            ['第1个月', '项目启动、组建体系、确定适用范围', '管理层批准记录、组织架构图、信息安全方针'],
            ['第2个月', '差距分析、确定推进计划', '差距分析结果、任务清单、总体进度表'],
            ['第3至4个月', '资产梳理、风险评估、风险处置计划、编制SoA', '信息资产台账、风险登记表、风险处置计划、适用性声明'],
            ['第4至5个月', '编制制度、程序与表单，管理层批准', '文件清单、各项制度与程序、批准记录'],
            ['第6至8个月', '全员培训、按制度开始运行、积累证据', '培训记录、访问权限复核记录、供方评价、事件记录'],
            ['第8个月', '培养内审员、实施内部审核', '内审计划、检查表与报告、纠正措施记录'],
            ['第9个月', '管理评审、向认证机构提交申请', '管理评审会议记录、申请资料'],
            ['第9至10个月', '第一阶段审核、纠正、第二阶段审核、纠正、注册', '审核报告、纠正措施报告、证书'],
          ],
        },
        {
          type: 'p',
          text: '认证机构的选择与申请建议在**第一阶段审核前3至4个月**着手，以便留出日程协调的余地。旺季较难预约到理想日期，因此在开始运行的同时并行询价是比较现实的做法。',
        },
        { type: 'h2', id: 'common-pitfalls', text: '四个常见的卡点' },
        {
          type: 'ul',
          items: [
            '**适用范围铺得过大** — 首次认证就覆盖全部实体、场所与服务，会让资产梳理、文件编制与证据收集同时膨胀。先聚焦主要服务与总部，待再认证时再扩大，也是可行的路径。',
            '**把文件编完当作终点** — 仅靠套模板填写的制度容易与现场实际脱节。第二阶段审核看的不是文件本身，而是按文件运行留下的记录。颗粒度应以“编写者以外的人也能照做”为标准。',
            '**做了但没有记录** — 实际执行了却没有记录日期、执行人、对象与结果的情况非常普遍。培训、权限复核、供方评价、备份检查等应在执行的同时完成记录。',
            '**内部审核流于形式** — 只在检查表上打勾的审核不会产生问题项，也就不会带来改进。应确保审核员的独立性，并抽样核查实际记录。',
          ],
        },
        { type: 'h2', id: 'after-certification', text: '获证之后：监督审核与再认证审核' },
        {
          type: 'p',
          text: '取得认证并非终点，后续还有维持体系的审核。通常的做法是注册后大致每年接受一次**监督审核**，并**每三年接受一次再认证审核**。监督审核的范围往往比初次审核更集中，但内部审核与管理评审仍需每年实施。',
        },
        {
          type: 'p',
          text: '也就是说，认证项目中建立的运行循环，需要按照“每年都要转起来”的前提来设计。如果证据收集依赖某一位负责人的手工作业，从第二年起负担会明显上升，也更容易出现记录缺失。',
        },
        { type: 'h2', id: 'manage-with-tools', text: '用工具统一管理进度与证据' },
        {
          type: 'p',
          text: '认证项目涉及信息资产台账、风险登记表、SoA、文件版本管理、培训完成情况、内审问题与纠正措施、管理评审记录等大量信息。若分散在电子表格与共享文件夹中，就很难看清进展到哪一步、缺少哪些证据，结果往往是审核前集中补齐、耗费大量时间。把风险、控制措施、文件与记录在一个工具中相互关联管理，进度与缺口可以即时可见，后续年度的维持也能沿用同一套机制。',
        },
        {
          type: 'p',
          text: '如果希望先弄清自己目前处于哪个阶段、接下来该从什么入手，可以从[ISMS现状自查](/research)开始。',
        },
      ],
      faq: [
        {
          question: 'ISO 27001最快需要多长时间？',
          answer:
            '取决于组织规模与现有规章的完备程度，通常以6个月左右为常见的下限。仅仅加快文件编制并没有太大意义，因为缺少一定期间的运行记录，第二阶段审核就没有足够的证据可查。一般认为至少需要约3个月的运行期，可以以此倒推安排日程。',
        },
        {
          question: '小规模公司也能取得认证吗？',
          answer:
            '可以。ISO/IEC 27001的要求可以按组织规模相称地应用，只要文件与运行同适用范围和风险相匹配，数人规模的组织同样可以获证。需要注意的是内部审核的独立性，应安排未承担受审核业务的人员担任审核员，或借助外部审核员。',
        },
        {
          question: '一共要接受几次审核？',
          answer:
            '初次认证通常为两次：审查文件与准备情况的第一阶段审核，以及审查运行情况的第二阶段审核。对提出的问题需提交纠正措施并按需接受确认。注册之后，大致每年一次的监督审核与每三年一次的再认证审核会持续进行。',
        },
        {
          question: '不请顾问，只靠公司自己能推进吗？',
          answer:
            '有企业是自行完成的。判断依据主要有三点：是否有能读懂标准要求的负责人、能否培养内审员、是否有可投入的工时。也常见部分借助外部力量的做法，例如只在差距分析与内部审核环节引入外部支持。无论哪种方式，实际运行体系并留存记录始终是本公司的工作。',
        },
        {
          question: '启动前公司内部最先要定下什么？',
          answer:
            '三件事：适用范围（涉及哪些组织、场所与服务）、认证的目的与期望时间、以及推进体制。其中适用范围尤为关键，它决定风险评估的对象、所需制度以及审核工作量。若动因是客户要求或投标要求，建议先确认对方要求的范围，以避免返工。',
        },
      ],
      keywords: [
        'ISO 27001 认证流程',
        'ISMS 认证步骤',
        'ISO 27001 周期',
        'ISMS 实施进度',
        '第一阶段审核',
        '第二阶段审核',
        '内部审核',
        '管理评审',
        '适用性声明',
      ],
    },
  },
};
