import type { GuideArticle } from '../types';

export const ismsCorrectiveActionExample: GuideArticle = {
  slug: 'isms-corrective-action-example',
  publishedAt: '2026-11-26',
  updatedAt: '2026-11-26',
  related: ['isms-statement-of-applicability', 'iso27001-annex-a-controls', 'isms-required-documents'],
  content: {
    ja: {
      title: 'ISMS是正処置の記入例｜アクセス権レビューの記録が見つからないとき',
      metaTitle: 'ISMS是正処置の記入例｜原因分析と有効性確認',
      description: '内部監査で四半期のアクセス権レビュー記録が見つからなかった架空事例を使い、事実の書き方、応急の修正、原因分析、担当と期限、証跡、次の四半期に行う独立した有効性確認までを具体的に示します。',
      lead: '内部監査でアクセス権レビューの記録を提示できなかったとき、まず確定している事実は「記録が見つからない」ことです。権限の再点検、記録が残らなかった原因の調査、次の四半期の有効性確認には、それぞれ別の結果を残します。',
      blocks: [
        { type: 'h2', id: 'finding', text: '監査で何を確認できなかったか' },
        { type: 'p', text: '継続運用モデル株式会社（架空）の案件 DEMO-ACCESS-001 を使います。社内手順は四半期ごとのアクセス権レビューと結果の保管を求めています。以下の日付・件数・調査結果は書き方を示すために加えた例です。' },
        {
          type: 'table',
          headers: ['記録欄', '記入例'],
          rows: [
            ['不適合の事実｜10月2日', '対象は7〜9月の顧客管理システム。所定フォルダにレビュー結果と確認者の記録がなく、運用担当にも提示を依頼したが確認できなかった。実施の有無は調査中。'],
            ['影響の確認と修正｜10月3日', '運用担当が現在の12アカウントを在籍・異動台帳と照合。異動済みの1名に旧権限が残り、当日取り消した。変更履歴を確認し、過去の利用状況の調査を別票に引き継いだ。'],
          ],
        },
        { type: 'h2', id: 'cause', text: '原因を確かめ、再発防止の担当と期限を決める' },
        { type: 'p', text: '当初の仮説は「担当交代時の引き継ぎ漏れ」。前任者・後任者に聞き取り、引き継ぎ票と過去2回の作業票を照合したところ、四半期の起票は前任者の個人予定に依存し、結果の保存先も手順にありませんでした。同じ手順を使う他のシステムにも未記録の回がないか確認します。' },
        {
          type: 'table',
          headers: ['記録欄', '記入例'],
          rows: [
            ['是正処置｜運用リーダー、10月15日期限', '四半期の作業票をチームの予定に登録し、実施者・代行者・確認者を指定。対象一覧、差異、処理結果、確認日、保存先を記入してから完了する手順に改訂。'],
            ['実施証跡｜10月15日', '手順v2、次回作業票 AC-Q4、10月3日の再点検票と権限変更番号を相互参照。初回是正の完了日を記録し、次回点検は未完了のまま残す。'],
          ],
        },
        { type: 'h2', id: 'effectiveness', text: '次の四半期に、別の人が再発の有無を確認する' },
        { type: 'p', text: '判定基準を先に決めます。「12月末の対象一覧全件と照合し、差異の処理、確認者、日付、保存先を期限内に追跡できること」。1月5日、初回是正に関与していない内部監査員が原本とAC-Q4を突合し、対象13件、差異1件の処理番号、12月27日の確認署名を確認したと記録します。' },
        { type: 'p', text: 'この例では有効と判定し、確認者と根拠を添えて責任者に終了承認を依頼します。記録に欠落があれば未完のまま原因を再検討し、担当と再確認日を設定します。初回の権限取消しだけでは、次の四半期も手順が回るかは判断できません。' },
        { type: 'p', text: '規格の要求事項は[ISO/IEC 27001:2022の公式案内](https://www.iso.org/standard/27001)で確認できます。' },
        { type: 'h2', id: 'demo', text: 'Riscalaで是正記録をたどる' },
        { type: 'p', text: '[評価用公開デモ](https://riscala-ai.com/ja/dev-login)で「井上拓（組織管理者）で是正デモを開始」を選びます。監査計画の「担当決定と初回是正」で担当を選び、不適合一覧で原因・是正処置・期限を保存します。担当の割当先はフォローアップです。チェックリストの証跡メモに架空の結果を記入し、「次回点検で有効性確認」は次回まで開いておきます。[公開版のシナリオ説明](https://github.com/rx-tomo/pjt007-isms-public/blob/main/docs/06-operations/audit-corrective-demo.md)' },
        { type: 'p', text: '公開デモのCSVは最初に観察した不足の記録です。証跡はメモとして入力でき、ファイル添付は対象外です。データは共有・日次初期化されるため、架空の内容で試してください。[通常のデモログイン](/dev-login)から継続運用の組織管理者を選び、[不適合一覧](/audit/nonconformities)で既存案件の原因・期限・進捗を確認できます。ローカル版で起動した場合も同じ役割選択を使います。' },
      ],
      faq: [
        { question: '是正処置の完了日を有効性確認日にできますか？', answer: '再発を判定する機会に合わせます。この事例では次回四半期の点検記録が必要なので、初回是正の完了日と次回の確認日は別に記録します。' },
      ],
      keywords: ['ISMS 是正処置 記入例', '内部監査 不適合', '有効性確認 アクセス権'],
    },
    en: {
      title: 'ISMS corrective action example: a missing quarterly access review',
      metaTitle: 'ISMS corrective action and effectiveness review example',
      description: 'Work through a missing access review, from evidence and immediate correction to cause, ownership, a deadline and an independent check the following quarter.',
      lead: 'A missing review record establishes an evidence gap. Whether the review happened is a separate question. Record the immediate access check, the cause investigation and the next quarterly verification so another reviewer can follow the decisions.',
      blocks: [
        { type: 'h2', id: 'finding', text: 'Record what the audit found' },
        { type: 'p', text: 'DEMO-ACCESS-001 is a fictional case about a missing quarterly review. Internal procedure requires the review and retention of the result. Dates, counts and findings below illustrate a possible completed record.' },
        {
          type: 'table',
          headers: ['Field', 'Example entry'],
          rows: [
            ['Finding · 2 October', 'No July–September review or reviewer sign-off for the customer system in the designated folder. Operations could not provide a copy. Whether the review took place is under investigation.'],
            ['Correction · 3 October', 'Operations reconciled 12 active accounts against staff and transfers. One transferred employee retained an old privilege. It was removed that day. A separate ticket tracks investigation of past use.'],
          ],
        },
        { type: 'h2', id: 'cause', text: 'Test the cause and assign the corrective work' },
        { type: 'p', text: 'The initial hypothesis was a missed handover. Interviews with both operators, the handover sheet and two previous tickets showed that only the former owner had a calendar reminder. The procedure also omitted the record location. Check other services using the procedure for similar gaps.' },
        {
          type: 'table',
          headers: ['Field', 'Example entry'],
          rows: [
            ['Action · operations lead, due 15 October', 'Schedule a quarterly team ticket. Name an operator, deputy and reviewer. Require scope, discrepancies, disposition, reviewer date and record location before completion.'],
            ['Evidence · 15 October', 'Cross-reference procedure v2, next review AC-Q4, the 3 October reconciliation and the permission-change ticket. Mark initial work complete. Leave next-quarter verification open.'],
          ],
        },
        { type: 'h2', id: 'effectiveness', text: 'Verify recurrence independently' },
        { type: 'p', text: 'Set the test in advance. Reconcile the full December population and trace each discrepancy, reviewer, date and record by the deadline. On 5 January an auditor independent of the corrective work compares AC-Q4 with the source register: 13 accounts, one resolved exception and reviewer sign-off on 27 December.' },
        { type: 'p', text: 'Record the verdict and evidence, then request closure approval. If evidence is missing, keep the case open, revisit the cause and assign a new review date. Removing one privilege proves only the initial correction.' },
        { type: 'p', text: 'See the [official ISO/IEC 27001:2022 overview](https://www.iso.org/standard/27001) for the applicable standard.' },
        { type: 'h2', id: 'demo', text: 'Walk the case in Riscala' },
        { type: 'p', text: 'Open the [hosted evaluation demo](https://riscala-ai.com/en/dev-login) and start the corrective-action case as the organization administrator. Assign the initial follow-up in the audit plan. Record the cause, action and due date on the nonconformity, then enter fictional evidence in the checklist memo. The assignment belongs to the follow-up. Leave next-quarter verification open. [Public scenario notes](https://github.com/rx-tomo/pjt007-isms-public/blob/main/docs/06-operations/audit-corrective-demo.md)' },
        { type: 'p', text: 'The CSV records the initial gap. The hosted demo accepts evidence text, disables file attachments and resets shared data daily. Alternatively, use [the regular role selector](/dev-login), select the ongoing-operations administrator and inspect cause, deadlines and progress in [nonconformities](/audit/nonconformities). Local installations use the same role selector.' },
      ],
      faq: [
        { question: 'Is the completion date also the effectiveness review date?', answer: 'Here the test depends on the next quarterly review. Record initial completion and the later verification separately.' },
      ],
      keywords: ['ISMS corrective action', 'access review case', 'effectiveness verification'],
    },
    zh: {
      title: 'ISMS纠正措施填写示例：找不到季度访问权限复核记录',
      metaTitle: 'ISMS纠正措施及有效性验证示例',
      description: '以季度访问权限复核记录缺失为例，从审核事实、即时纠正、原因调查到负责人、期限、证据，再到下一季度由独立人员验证有效性。',
      lead: '找不到记录，首先能确认的是证据缺失。复核是否执行，还需调查。把当前权限的核对、原因调查和下一季度的验证分别记录，后来接手的人才能判断是否可以结案。',
      blocks: [
        { type: 'h2', id: 'finding', text: '写下审核能确认的事实' },
        { type: 'p', text: 'DEMO-ACCESS-001是一个虚构案例。内部规程要求每季度复核权限并保留结果。以下日期、数量及调查结果是为说明填写方法补充的示例。' },
        {
          type: 'table',
          headers: ['记录项', '填写示例'],
          rows: [
            ['不符合事实｜10月2日', '指定目录中未找到客户系统7月至9月的复核结果和签字记录，运维人员也未能提供。是否执行过复核仍在调查。'],
            ['影响与即时纠正｜10月3日', '运维人员将12个账号与在职及调岗清单核对，撤销一名调岗员工遗留的旧权限。已另开工单调查历史使用情况。'],
          ],
        },
        { type: 'h2', id: 'cause', text: '验证原因，确定负责人和期限' },
        { type: 'p', text: '最初怀疑交接遗漏。询问前后任人员并核对交接单及前两次工单，发现提醒只设在前任个人日历中，规程也没有指定保存位置。应检查采用同一规程的其他系统是否有类似缺口。' },
        {
          type: 'table',
          headers: ['记录项', '填写示例'],
          rows: [
            ['纠正措施｜运维组长，10月15日前', '建立团队季度工单，指定执行人、替补和复核人。修订规程，完成前填写范围、差异、处理结果、复核日期及保存位置。'],
            ['执行证据｜10月15日', '关联规程v2、下季度工单AC-Q4、10月3日核对表及权限变更单。记录首次纠正完成日期，下季度验证保持待办。'],
          ],
        },
        { type: 'h2', id: 'effectiveness', text: '由独立人员在下一季度验证' },
        { type: 'p', text: '提前写明标准：12月底核对全部账号，并能在期限内追踪差异处置、复核人、日期及记录。1月5日，未参与首次整改的内部审核员将AC-Q4与原始台账核对，记录13个账号、1项差异的处理编号及12月27日的复核签字。' },
        { type: 'p', text: '本例中审核员记录有效结论及依据，再申请结案批准。若有遗漏，应继续调查，指定负责人和复查日期。首次撤权本身不能证明下一季度会按期执行。' },
        { type: 'p', text: '标准信息见[ISO/IEC 27001:2022官方说明](https://www.iso.org/standard/27001)。' },
        { type: 'h2', id: 'demo', text: '在Riscala中查看同一流程' },
        { type: 'p', text: '打开[公开评估演示](https://riscala-ai.com/zh/dev-login)，以组织管理员启动纠正案例。在审核计划中指派首次跟进任务，再到不符合项中记录原因、措施和期限。负责人归属于跟进任务。在检查表的证据备注中填写虚构记录，保留下季度验证任务。[公开场景说明](https://github.com/rx-tomo/pjt007-isms-public/blob/main/docs/06-operations/audit-corrective-demo.md)' },
        { type: 'p', text: 'CSV记录的是最初发现的缺口。公开演示支持证据备注，未开放附件上传；共享数据每天重置。也可从[常规角色选择](/dev-login)选择持续运营场景的组织管理员，在[不符合项清单](/audit/nonconformities)查看现有事项的原因、期限和进度。在本地运行时也使用同一角色选择入口。' },
      ],
      faq: [
        { question: '首次整改完成时能同时判定有效吗？', answer: '本例需要观察下一季度是否真正复核。首次整改和后续验证应分别记录日期与依据。' },
      ],
      keywords: ['ISMS纠正措施', '内部审核不符合项', '有效性验证'],
    },
  },
};
