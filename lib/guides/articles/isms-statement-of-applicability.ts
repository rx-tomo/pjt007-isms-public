import type { GuideArticle } from '../types';

export const ismsStatementOfApplicability: GuideArticle = {
  slug: 'isms-statement-of-applicability',
  publishedAt: '2026-11-26',
  updatedAt: '2026-11-26',
  related: ['iso27001-annex-a-controls', 'isms-risk-assessment', 'isms-corrective-action-example'],
  content: {
    ja: {
      title: 'ISMS適用宣言書の書き方｜適用・未実施・除外の記入例',
      metaTitle: 'ISMS適用宣言書の書き方と記入例',
      description: '架空のIT企業を例に、リスクから管理策を選び、適用理由・除外理由・実施状況・証跡を適用宣言書に記入する方法を解説します。未実施の対策に担当と期限を置き、見直し・承認まで記録する例も紹介します。',
      lead: '適用宣言書（SoA）を読む人が知りたいのは「なぜこの管理策が必要で、今どこまで実施できているか」です。適用の判断と実施状況は別々に記入します。青葉クラウド社（架空）の3行を例に、その違いを見てみましょう。',
      blocks: [
        { type: 'h2', id: 'scope', text: '適用範囲とリスクを先に決める' },
        { type: 'p', text: '同社の対象業務は顧客のSaaS運用代行です。開発や開発委託は契約範囲に含まれません。リスク台帳には、退職後の顧客環境へのアクセス（R-01）と、操作ログの異常を見逃すリスク（R-02）を登録しました。必要な対策を決めたら[附属書Aの93項目](/guide/iso27001-annex-a-controls)と照合し、自社独自の対策も必要なら追加します。' },
        { type: 'h2', id: 'examples', text: '適用宣言書にどう書くか｜3つの記入例' },
        {
          type: 'table',
          headers: ['管理策と判断', '根拠・状態・参照先'],
          rows: [
            ['A.5.18 アクセス権限｜適用・実施済み', 'R-01。退職日に権限を取り消し、四半期ごとに利用者と突合する。運用責任者が9月30日に名簿12件を照合。結果と承認者は記録 AR-09 に保存。'],
            ['A.8.16 監視活動｜適用・未実施', 'R-02。夜間の異常操作を把握する必要がある。ログは保存中だがアラートは未設定。運用リーダーが12月15日までに通知試験を行い、対応票 T-17 に結果を添付する。現時点の証跡は計画書のみ。'],
            ['A.8.30 外部委託による開発｜除外', '受託業務に開発がなく、開発を委託する契約もない。業務責任者がサービス仕様書 S-02 と委託先一覧の対象業務を照合。開発を含む契約を結ぶ前に再判定する。'],
          ],
        },
        { type: 'h2', id: 'review', text: '未実施の管理策を残したまま、何を承認するか' },
        { type: 'p', text: '11月20日、ISMS事務局がSoA第1.2版を作成し、変更理由に「夜間監視の不足をR-02に追加」と記入。11月22日、責任者が選定理由とT-17の期限を確認し、この版を承認しました。監視活動の状態は「未実施」のままです。リスク所有者は期限まで残るリスクと対応計画を別途確認します。' },
        { type: 'p', text: '12月15日の通知試験で、対象ログ・通知先・受信時刻を照合します。合格なら証跡番号と確認日を次版に追記し、失敗なら理由と次の期限をT-17に残します。前版を残せば、審査時点でどの判断が有効だったかを追えます。' },
        { type: 'p', text: '規格の要求事項は[ISO/IEC 27001:2022の公式案内](https://www.iso.org/standard/27001)で確認できます。' },
        { type: 'h2', id: 'demo', text: 'Riscalaで管理策の判断を確かめる' },
        { type: 'p', text: '[デモログイン](/dev-login)で初回登録の組織管理者を選び、[管理策の画面](/settings/controls)を開きます。登録済みの管理策を1件選び、関連するリスク対応策、適用判断、理由欄を確認してください。除外を選ぶと除外理由を記録できます。保存後の承認申請は別の操作です。記事の会社名・記録番号は記入例です。' },
      ],
      faq: [
        { question: '未実施の管理策を除外してもよいですか？', answer: '対象リスクへの対応に必要なら「適用」とし、実施状況、担当、期限を記録します。除外には、自社の範囲や活動に照らした理由が必要です。' },
      ],
      keywords: ['ISMS 適用宣言書', 'SoA 記入例', '管理策 除外理由'],
    },
    en: {
      title: 'How to write a Statement of Applicability: three worked entries',
      metaTitle: 'ISMS Statement of Applicability examples',
      description: 'Follow three fictional SoA entries from risk to inclusion or exclusion, evidence, a planned control, review and approval. Try the decision fields in Riscala.',
      lead: 'An SoA records why a control is needed and whether it is operating. Keep those two decisions in separate fields. Aoba Cloud (fictional), a managed SaaS operator, has a good reason to include a control it has yet to implement.',
      blocks: [
        { type: 'h2', id: 'scope', text: 'Start with the scope and the risk' },
        { type: 'p', text: 'Aoba operates customer SaaS environments. Its contracts cover neither software development nor outsourced development. Its register identifies access after staff leave (R-01) and missed anomalies in activity logs (R-02). Select controls for those risks, compare the result with [the 93 Annex A controls](/guide/iso27001-annex-a-controls), and include additional controls where needed.' },
        { type: 'h2', id: 'examples', text: 'Three entries from the same SoA' },
        {
          type: 'table',
          headers: ['Control and decision', 'Rationale, status and evidence'],
          rows: [
            ['A.5.18 Access rights · included, operating', 'R-01. Revoke access on departure and reconcile accounts quarterly. On 30 September the operations manager checked 12 accounts. AR-09 identifies the results and reviewer.'],
            ['A.8.16 Monitoring · included, planned', 'R-02. Logs are retained, but night-time anomalies trigger no alert. The operations lead will test alert delivery by 15 December. T-17 contains the plan. Test results are still due.'],
            ['A.8.30 Outsourced development · excluded', 'The service owner checked service specification S-02 and the supplier register. Neither includes development. Reassess before signing a contract that adds it.'],
          ],
        },
        { type: 'h2', id: 'review', text: 'Approve the decision and follow up the open work' },
        { type: 'p', text: 'On 20 November the ISMS coordinator issued draft v1.2 to add the monitoring gap for R-02. On 22 November the manager approved the rationale and T-17 deadline. Monitoring remained planned. The risk owner separately reviews the treatment plan and the exposure until the deadline.' },
        { type: 'p', text: 'On 15 December compare the source event, recipient and alert delivery time. On success, add the test reference and date to the next version. Otherwise keep T-17 open with the failure and new deadline. Retain v1.2 to show what was known at approval.' },
        { type: 'p', text: 'See the [official ISO/IEC 27001:2022 overview](https://www.iso.org/standard/27001) for the applicable standard.' },
        { type: 'h2', id: 'demo', text: 'Try a control decision in Riscala' },
        { type: 'p', text: 'At [demo login](/dev-login), select the organization administrator for initial certification, then open [controls](/settings/controls). Inspect a registered control, its linked treatments and decision fields. Excluding a control opens a field for the reason. Save a decision before submitting it for approval. The example company and reference numbers are illustrative.' },
      ],
      faq: [
        { question: 'Can we exclude a control until it is implemented?', answer: 'If treatment requires it, include it. Record its implementation status, owner and deadline. An exclusion needs a reason grounded in scope and activity.' },
      ],
      keywords: ['Statement of Applicability', 'SoA example', 'control exclusion'],
    },
    zh: {
      title: 'ISMS适用性声明怎么写？适用、待实施与排除的三个示例',
      metaTitle: 'ISMS适用性声明（SoA）填写示例',
      description: '通过一家虚构的IT企业，了解如何从风险出发，记录控制措施的适用或排除理由、实施状态、证据和期限，并在复核和批准后跟进未完成的措施。',
      lead: '适用性声明（SoA）回答两个问题：为什么需要这项控制措施，目前实施到了哪一步？把两项判断分别记录，就能说明为什么一项措施已确定适用，现场却还没有实施记录。',
      blocks: [
        { type: 'h2', id: 'scope', text: '先确定范围与风险' },
        { type: 'p', text: '青叶云公司（虚构）为客户运维SaaS环境。合同范围不含软件开发，也没有委托开发。风险登记册列出离职后仍能访问客户环境（R-01）和未发现日志异常（R-02）。先确定处置措施，再与[附录A的93项控制措施](/guide/iso27001-annex-a-controls)核对；必要时补上企业自己的措施。' },
        { type: 'h2', id: 'examples', text: '同一份声明的三行示例' },
        {
          type: 'table',
          headers: ['措施与决定', '理由、状态及记录'],
          rows: [
            ['A.5.18 访问权限｜适用、已实施', '针对R-01，离职当天撤权，每季度核对账号。9月30日运维负责人核对12个账号，结果及复核人见记录AR-09。'],
            ['A.8.16 监视活动｜适用、待实施', '针对R-02，已保留日志，夜间异常尚未触发告警。运维组长应在12月15日前测试通知并将结果附于工单T-17。目前只有计划书。'],
            ['A.8.30 外包开发｜排除', '业务负责人核对服务说明S-02和供应商清单，确认不存在自行或委托开发。签订涉及开发的合同前重新判断。'],
          ],
        },
        { type: 'h2', id: 'review', text: '批准当前决定，跟进未完成工作' },
        { type: 'p', text: '11月20日，ISMS协调员在第1.2版中增加R-02的夜间监控缺口。11月22日，负责人确认理由和T-17期限后批准本版，监视活动仍为待实施。风险所有者另行审查处置计划和期限内的剩余风险。' },
        { type: 'p', text: '12月15日比对日志事件、收件人和告警时间。成功则在下一版记录测试编号和日期；失败则在T-17中写明原因和新期限。保留前版，以便还原批准时的判断。' },
        { type: 'p', text: '标准信息见[ISO/IEC 27001:2022官方说明](https://www.iso.org/standard/27001)。' },
        { type: 'h2', id: 'demo', text: '在Riscala中查看适用判断' },
        { type: 'p', text: '打开[演示登录](/dev-login)，选择初次认证场景的组织管理员，再进入[控制措施](/settings/controls)。选一项已登记措施，查看关联的风险处置、适用判断及理由。选择排除后可填写排除理由。保存决定后可另行提交审批。文中的公司及编号均为示例。' },
      ],
      faq: [
        { question: '尚未实施的措施可以暂列为排除吗？', answer: '若风险处置需要，应标为适用，并记录实施状态、负责人和期限。排除理由应能由业务范围和实际活动支撑。' },
      ],
      keywords: ['适用性声明', 'SoA 填写示例', '排除理由'],
    },
  },
};
