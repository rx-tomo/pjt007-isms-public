/**
 * Threat Pattern Data
 *
 * Contains 45 common IT security threat patterns for offline risk assessment.
 * Covers confidentiality, integrity, and availability categories.
 *
 * @module lib/ai/knowledgeBase/ThreatPatternData
 */

import type { ThreatPattern } from './ThreatPatterns'

/**
 * Collection of common threat patterns for ISMS risk assessment
 */
export const threatPatterns: ThreatPattern[] = [
  // ============================================
  // CONFIDENTIALITY THREATS (15 patterns)
  // ============================================
  {
    id: 'THREAT-001',
    name: 'Data Breach via External Attack',
    nameJa: '外部攻撃によるデータ漏洩',
    description: 'Unauthorized access to sensitive data by external attackers through hacking, exploitation of vulnerabilities, or other malicious means.',
    descriptionJa: 'ハッキング、脆弱性の悪用、その他の悪意ある手段による外部攻撃者の機密データへの不正アクセス。',
    category: 'confidentiality',
    assetTypes: ['database', 'server', 'application', 'cloud'],
    defaultProbability: 'medium',
    defaultImpact: 'critical',
    keywords: ['data breach', 'hack', 'hacking', 'unauthorized access', 'data theft', 'exfiltration', 'breach', 'leak'],
    applicableControls: ['A.5.1', 'A.8.2', 'A.8.3', 'A.8.24'],
    mitigationSuggestions: [
      'Implement intrusion detection and prevention systems',
      'Conduct regular vulnerability assessments',
      'Encrypt sensitive data at rest and in transit',
      'Implement network segmentation'
    ]
  },
  {
    id: 'THREAT-002',
    name: 'Insider Threat - Malicious Employee',
    nameJa: '内部脅威 - 悪意ある従業員',
    description: 'Intentional data theft, sabotage, or security breach by current or former employees with legitimate access.',
    descriptionJa: '正当なアクセス権を持つ現職または元従業員による意図的なデータ窃取、妨害行為、またはセキュリティ侵害。',
    category: 'confidentiality',
    assetTypes: ['database', 'server', 'application', 'document'],
    defaultProbability: 'medium',
    defaultImpact: 'high',
    keywords: ['insider threat', 'insider', 'malicious employee', 'internal threat', 'employee theft', 'sabotage'],
    applicableControls: ['A.5.10', 'A.6.1', 'A.6.2', 'A.6.5', 'A.8.2'],
    mitigationSuggestions: [
      'Implement principle of least privilege',
      'Conduct background checks on employees',
      'Monitor user activity and access patterns',
      'Implement data loss prevention (DLP) solutions'
    ]
  },
  {
    id: 'THREAT-003',
    name: 'Phishing Attack',
    nameJa: 'フィッシング攻撃',
    description: 'Social engineering attack using fraudulent emails or websites to trick users into revealing sensitive information.',
    descriptionJa: '詐欺的なメールやウェブサイトを使用してユーザーを騙し、機密情報を漏洩させるソーシャルエンジニアリング攻撃。',
    category: 'confidentiality',
    assetTypes: ['endpoint', 'email', 'application', 'user'],
    defaultProbability: 'high',
    defaultImpact: 'medium',
    keywords: ['phishing', 'social engineering', 'email attack', 'spear phishing', 'credential theft', 'fraudulent'],
    applicableControls: ['A.6.3', 'A.8.7', 'A.8.21', 'A.8.22'],
    mitigationSuggestions: [
      'Implement email filtering and anti-phishing solutions',
      'Conduct regular security awareness training',
      'Enable multi-factor authentication',
      'Use email authentication protocols (SPF, DKIM, DMARC)'
    ]
  },
  {
    id: 'THREAT-004',
    name: 'Credential Theft',
    nameJa: '認証情報の窃取',
    description: 'Unauthorized acquisition of user credentials through various means including keyloggers, credential stuffing, or password spraying.',
    descriptionJa: 'キーロガー、クレデンシャルスタッフィング、パスワードスプレイなどの様々な手段による認証情報の不正取得。',
    category: 'confidentiality',
    assetTypes: ['application', 'server', 'endpoint', 'identity'],
    defaultProbability: 'high',
    defaultImpact: 'high',
    keywords: ['credential', 'password', 'authentication', 'keylogger', 'credential stuffing', 'password spray', 'brute force'],
    applicableControls: ['A.5.17', 'A.8.2', 'A.8.5', 'A.8.24'],
    mitigationSuggestions: [
      'Implement multi-factor authentication',
      'Enforce strong password policies',
      'Use password managers',
      'Monitor for compromised credentials'
    ]
  },
  {
    id: 'THREAT-005',
    name: 'Eavesdropping / Network Sniffing',
    nameJa: '盗聴 / ネットワークスニッフィング',
    description: 'Unauthorized interception of network traffic to capture sensitive data in transit.',
    descriptionJa: 'ネットワークトラフィックの不正傍受による転送中の機密データの取得。',
    category: 'confidentiality',
    assetTypes: ['network', 'wireless', 'communication'],
    defaultProbability: 'medium',
    defaultImpact: 'high',
    keywords: ['eavesdropping', 'sniffing', 'wiretapping', 'interception', 'man in the middle', 'network capture'],
    applicableControls: ['A.8.20', 'A.8.21', 'A.8.24', 'A.8.26'],
    mitigationSuggestions: [
      'Encrypt all network traffic using TLS/SSL',
      'Use VPN for remote access',
      'Implement network segmentation',
      'Secure wireless networks with WPA3'
    ]
  },
  {
    id: 'THREAT-006',
    name: 'Physical Theft of Devices',
    nameJa: 'デバイスの物理的盗難',
    description: 'Loss or theft of laptops, mobile devices, or storage media containing sensitive information.',
    descriptionJa: '機密情報を含むラップトップ、モバイルデバイス、または記憶媒体の紛失または盗難。',
    category: 'confidentiality',
    assetTypes: ['endpoint', 'mobile', 'storage', 'laptop'],
    defaultProbability: 'medium',
    defaultImpact: 'high',
    keywords: ['theft', 'stolen', 'lost device', 'physical theft', 'laptop theft', 'mobile theft'],
    applicableControls: ['A.7.1', 'A.7.9', 'A.8.1', 'A.8.10'],
    mitigationSuggestions: [
      'Implement full disk encryption',
      'Enable remote wipe capabilities',
      'Use device tracking solutions',
      'Implement clear desk and screen policies'
    ]
  },
  {
    id: 'THREAT-007',
    name: 'Cloud Data Exposure',
    nameJa: 'クラウドデータの露出',
    description: 'Misconfigured cloud storage or services leading to unauthorized access to sensitive data.',
    descriptionJa: '設定ミスによるクラウドストレージやサービスからの機密データへの不正アクセス。',
    category: 'confidentiality',
    assetTypes: ['cloud', 'storage', 'database', 'application'],
    defaultProbability: 'medium',
    defaultImpact: 'critical',
    keywords: ['cloud', 'misconfiguration', 'S3 bucket', 'exposed', 'public access', 'cloud storage'],
    applicableControls: ['A.5.23', 'A.8.2', 'A.8.9', 'A.8.11'],
    mitigationSuggestions: [
      'Implement cloud security posture management',
      'Regularly audit cloud configurations',
      'Enable access logging and monitoring',
      'Use infrastructure as code with security scanning'
    ]
  },
  {
    id: 'THREAT-008',
    name: 'Third-Party Data Breach',
    nameJa: 'サードパーティのデータ漏洩',
    description: 'Data breach occurring at a vendor, supplier, or partner with access to organizational data.',
    descriptionJa: '組織のデータにアクセスできるベンダー、サプライヤー、またはパートナーで発生するデータ漏洩。',
    category: 'confidentiality',
    assetTypes: ['vendor', 'cloud', 'application', 'api'],
    defaultProbability: 'medium',
    defaultImpact: 'high',
    keywords: ['third party', 'vendor', 'supplier', 'supply chain', 'partner breach', 'outsourcing'],
    applicableControls: ['A.5.19', 'A.5.20', 'A.5.21', 'A.5.22'],
    mitigationSuggestions: [
      'Conduct vendor security assessments',
      'Include security requirements in contracts',
      'Monitor vendor security posture',
      'Limit data sharing with third parties'
    ]
  },
  {
    id: 'THREAT-009',
    name: 'Unauthorized Database Access',
    nameJa: 'データベースへの不正アクセス',
    description: 'Direct unauthorized access to database systems bypassing application controls.',
    descriptionJa: 'アプリケーション制御をバイパスしたデータベースシステムへの直接的な不正アクセス。',
    category: 'confidentiality',
    assetTypes: ['database', 'server', 'application'],
    defaultProbability: 'medium',
    defaultImpact: 'critical',
    keywords: ['database', 'database access', 'unauthorized', 'direct access', 'db breach', 'data access'],
    applicableControls: ['A.5.15', 'A.8.2', 'A.8.3', 'A.8.11'],
    mitigationSuggestions: [
      'Implement database activity monitoring',
      'Use database firewalls',
      'Restrict direct database access',
      'Encrypt database connections'
    ]
  },
  {
    id: 'THREAT-010',
    name: 'API Key Exposure',
    nameJa: 'APIキーの露出',
    description: 'Accidental or malicious exposure of API keys, tokens, or secrets in code repositories or logs.',
    descriptionJa: 'コードリポジトリやログでのAPIキー、トークン、シークレットの偶発的または悪意ある露出。',
    category: 'confidentiality',
    assetTypes: ['api', 'application', 'repository', 'code'],
    defaultProbability: 'high',
    defaultImpact: 'high',
    keywords: ['api key', 'secret', 'token', 'credential exposure', 'hardcoded', 'leaked credentials'],
    applicableControls: ['A.8.4', 'A.8.9', 'A.8.24', 'A.8.31'],
    mitigationSuggestions: [
      'Use secrets management solutions',
      'Implement pre-commit hooks to detect secrets',
      'Rotate credentials regularly',
      'Never hardcode secrets in source code'
    ]
  },
  {
    id: 'THREAT-011',
    name: 'Social Engineering - Pretexting',
    nameJa: 'ソーシャルエンジニアリング - プリテキスティング',
    description: 'Manipulation of employees through fabricated scenarios to obtain sensitive information or access.',
    descriptionJa: '機密情報やアクセスを取得するための捏造されたシナリオによる従業員の操作。',
    category: 'confidentiality',
    assetTypes: ['user', 'process', 'endpoint'],
    defaultProbability: 'medium',
    defaultImpact: 'high',
    keywords: ['social engineering', 'pretexting', 'manipulation', 'impersonation', 'vishing', 'scam'],
    applicableControls: ['A.6.3', 'A.5.10', 'A.8.7'],
    mitigationSuggestions: [
      'Implement security awareness training',
      'Establish verification procedures for sensitive requests',
      'Create incident reporting culture',
      'Test employees with simulated attacks'
    ]
  },
  {
    id: 'THREAT-012',
    name: 'Shoulder Surfing',
    nameJa: 'ショルダーサーフィン',
    description: 'Visual observation of sensitive information by unauthorized individuals in physical proximity.',
    descriptionJa: '物理的に近くにいる不正な個人による機密情報の視覚的観察。',
    category: 'confidentiality',
    assetTypes: ['endpoint', 'mobile', 'user', 'facility'],
    defaultProbability: 'medium',
    defaultImpact: 'low',
    keywords: ['shoulder surfing', 'visual observation', 'spying', 'watching', 'screen viewing'],
    applicableControls: ['A.7.1', 'A.7.6', 'A.8.1'],
    mitigationSuggestions: [
      'Use privacy screens on monitors',
      'Implement clean screen policies',
      'Position monitors away from public view',
      'Use secure areas for sensitive work'
    ]
  },
  {
    id: 'THREAT-013',
    name: 'Dumpster Diving',
    nameJa: 'ダンプスターダイビング',
    description: 'Retrieval of sensitive information from improperly disposed documents or storage media.',
    descriptionJa: '不適切に廃棄された文書や記憶媒体からの機密情報の取得。',
    category: 'confidentiality',
    assetTypes: ['document', 'storage', 'endpoint'],
    defaultProbability: 'low',
    defaultImpact: 'medium',
    keywords: ['dumpster diving', 'disposal', 'trash', 'shredding', 'document disposal', 'waste'],
    applicableControls: ['A.7.10', 'A.7.14', 'A.8.10'],
    mitigationSuggestions: [
      'Implement secure document destruction',
      'Use cross-cut shredders',
      'Properly sanitize storage media before disposal',
      'Train employees on proper disposal procedures'
    ]
  },
  {
    id: 'THREAT-014',
    name: 'Session Hijacking',
    nameJa: 'セッションハイジャック',
    description: 'Unauthorized takeover of a valid user session to gain access to systems or data.',
    descriptionJa: 'システムやデータへのアクセスを得るための有効なユーザーセッションの不正な乗っ取り。',
    category: 'confidentiality',
    assetTypes: ['application', 'web', 'server'],
    defaultProbability: 'medium',
    defaultImpact: 'high',
    keywords: ['session hijacking', 'session theft', 'cookie theft', 'session fixation', 'token hijacking'],
    applicableControls: ['A.8.5', 'A.8.24', 'A.8.26'],
    mitigationSuggestions: [
      'Use secure session management',
      'Implement session timeout policies',
      'Use HTTP-only and secure cookies',
      'Regenerate session IDs after authentication'
    ]
  },
  {
    id: 'THREAT-015',
    name: 'Privacy Violation - Data Misuse',
    nameJa: 'プライバシー侵害 - データの誤用',
    description: 'Unauthorized collection, processing, or sharing of personal data in violation of privacy regulations.',
    descriptionJa: 'プライバシー規制に違反した個人データの不正な収集、処理、または共有。',
    category: 'confidentiality',
    assetTypes: ['database', 'application', 'process', 'document'],
    defaultProbability: 'medium',
    defaultImpact: 'high',
    keywords: ['privacy', 'GDPR', 'personal data', 'data misuse', 'consent', 'PII', 'data protection'],
    applicableControls: ['A.5.33', 'A.5.34', 'A.8.2', 'A.8.11'],
    mitigationSuggestions: [
      'Implement data classification and handling procedures',
      'Conduct privacy impact assessments',
      'Establish data retention policies',
      'Train employees on data protection requirements'
    ]
  },

  // ============================================
  // INTEGRITY THREATS (15 patterns)
  // ============================================
  {
    id: 'THREAT-016',
    name: 'Malware Infection',
    nameJa: 'マルウェア感染',
    description: 'Installation of malicious software including viruses, trojans, spyware, or worms that can modify or destroy data.',
    descriptionJa: 'データを変更または破壊する可能性のあるウイルス、トロイの木馬、スパイウェア、ワームなどの悪意のあるソフトウェアのインストール。',
    category: 'integrity',
    assetTypes: ['endpoint', 'server', 'network', 'application'],
    defaultProbability: 'high',
    defaultImpact: 'high',
    keywords: ['malware', 'virus', 'trojan', 'worm', 'spyware', 'infection', 'malicious software'],
    applicableControls: ['A.8.7', 'A.8.8', 'A.8.19', 'A.8.23'],
    mitigationSuggestions: [
      'Deploy and maintain anti-malware solutions',
      'Keep systems and software updated',
      'Implement application whitelisting',
      'Restrict administrative privileges'
    ]
  },
  {
    id: 'THREAT-017',
    name: 'SQL Injection',
    nameJa: 'SQLインジェクション',
    description: 'Injection of malicious SQL code through application inputs to manipulate database queries and modify data.',
    descriptionJa: 'アプリケーション入力を通じた悪意のあるSQLコードの注入によるデータベースクエリの操作とデータの変更。',
    category: 'integrity',
    assetTypes: ['database', 'application', 'web'],
    defaultProbability: 'medium',
    defaultImpact: 'critical',
    keywords: ['SQL injection', 'SQLi', 'injection', 'database attack', 'query manipulation', 'DROP TABLE'],
    applicableControls: ['A.8.26', 'A.8.28', 'A.8.29'],
    mitigationSuggestions: [
      'Use parameterized queries and prepared statements',
      'Implement input validation and sanitization',
      'Use web application firewalls',
      'Apply principle of least privilege for database accounts'
    ]
  },
  {
    id: 'THREAT-018',
    name: 'Man-in-the-Middle Attack',
    nameJa: '中間者攻撃',
    description: 'Interception and potential modification of communications between two parties without their knowledge.',
    descriptionJa: '二者間の通信を知らないうちに傍受し、潜在的に変更する攻撃。',
    category: 'integrity',
    assetTypes: ['network', 'communication', 'application', 'wireless'],
    defaultProbability: 'medium',
    defaultImpact: 'high',
    keywords: ['man in the middle', 'MITM', 'interception', 'proxy attack', 'ARP spoofing', 'SSL stripping'],
    applicableControls: ['A.8.20', 'A.8.21', 'A.8.24', 'A.8.26'],
    mitigationSuggestions: [
      'Implement end-to-end encryption',
      'Use certificate pinning',
      'Deploy mutual TLS authentication',
      'Monitor for ARP spoofing attacks'
    ]
  },
  {
    id: 'THREAT-019',
    name: 'Data Tampering',
    nameJa: 'データ改ざん',
    description: 'Unauthorized modification of data at rest or in transit to compromise its integrity.',
    descriptionJa: '保存中または転送中のデータの整合性を損なう不正な変更。',
    category: 'integrity',
    assetTypes: ['database', 'storage', 'application', 'document'],
    defaultProbability: 'medium',
    defaultImpact: 'high',
    keywords: ['tampering', 'modification', 'data alteration', 'unauthorized change', 'data corruption', 'falsification'],
    applicableControls: ['A.8.4', 'A.8.11', 'A.8.24', 'A.8.33'],
    mitigationSuggestions: [
      'Implement digital signatures and checksums',
      'Use database transaction logging',
      'Enable audit trails for data changes',
      'Implement version control for critical data'
    ]
  },
  {
    id: 'THREAT-020',
    name: 'Cross-Site Scripting (XSS)',
    nameJa: 'クロスサイトスクリプティング(XSS)',
    description: 'Injection of malicious scripts into web pages viewed by other users to steal data or perform actions.',
    descriptionJa: '他のユーザーが閲覧するWebページへの悪意のあるスクリプトの注入によるデータの窃取やアクションの実行。',
    category: 'integrity',
    assetTypes: ['web', 'application', 'browser'],
    defaultProbability: 'high',
    defaultImpact: 'medium',
    keywords: ['XSS', 'cross-site scripting', 'script injection', 'stored XSS', 'reflected XSS', 'DOM XSS'],
    applicableControls: ['A.8.26', 'A.8.28', 'A.8.29'],
    mitigationSuggestions: [
      'Implement output encoding',
      'Use Content Security Policy (CSP)',
      'Validate and sanitize all user inputs',
      'Use HTTP-only cookies'
    ]
  },
  {
    id: 'THREAT-021',
    name: 'Code Injection',
    nameJa: 'コードインジェクション',
    description: 'Injection of malicious code into an application to alter its execution flow or behavior.',
    descriptionJa: 'アプリケーションへの悪意のあるコードの注入により、実行フローや動作を変更する攻撃。',
    category: 'integrity',
    assetTypes: ['application', 'server', 'web'],
    defaultProbability: 'medium',
    defaultImpact: 'critical',
    keywords: ['code injection', 'command injection', 'OS injection', 'shell injection', 'remote code execution', 'RCE'],
    applicableControls: ['A.8.26', 'A.8.28', 'A.8.29', 'A.8.31'],
    mitigationSuggestions: [
      'Avoid dynamic code execution',
      'Implement strict input validation',
      'Use safe APIs that avoid system commands',
      'Apply principle of least privilege'
    ]
  },
  {
    id: 'THREAT-022',
    name: 'Supply Chain Attack',
    nameJa: 'サプライチェーン攻撃',
    description: 'Compromise of software or hardware through manipulation of the supply chain or development process.',
    descriptionJa: 'サプライチェーンや開発プロセスの操作によるソフトウェアやハードウェアの侵害。',
    category: 'integrity',
    assetTypes: ['software', 'application', 'server', 'vendor'],
    defaultProbability: 'low',
    defaultImpact: 'critical',
    keywords: ['supply chain', 'third party', 'dependency', 'package', 'library', 'vendor compromise', 'SolarWinds'],
    applicableControls: ['A.5.19', 'A.5.20', 'A.5.21', 'A.8.30'],
    mitigationSuggestions: [
      'Verify software integrity with digital signatures',
      'Use software composition analysis',
      'Maintain software bill of materials (SBOM)',
      'Monitor dependencies for vulnerabilities'
    ]
  },
  {
    id: 'THREAT-023',
    name: 'Configuration Tampering',
    nameJa: '設定の改ざん',
    description: 'Unauthorized modification of system or application configurations to weaken security controls.',
    descriptionJa: 'セキュリティコントロールを弱めるためのシステムやアプリケーション設定の不正な変更。',
    category: 'integrity',
    assetTypes: ['server', 'network', 'application', 'cloud'],
    defaultProbability: 'medium',
    defaultImpact: 'high',
    keywords: ['configuration', 'config tampering', 'settings change', 'unauthorized modification', 'security settings'],
    applicableControls: ['A.8.9', 'A.8.19', 'A.8.32', 'A.8.34'],
    mitigationSuggestions: [
      'Implement configuration management',
      'Use infrastructure as code with version control',
      'Monitor for configuration changes',
      'Apply baseline security configurations'
    ]
  },
  {
    id: 'THREAT-024',
    name: 'Log Tampering',
    nameJa: 'ログの改ざん',
    description: 'Modification or deletion of log files to hide evidence of malicious activity.',
    descriptionJa: '悪意のある活動の証拠を隠すためのログファイルの変更または削除。',
    category: 'integrity',
    assetTypes: ['server', 'application', 'network', 'storage'],
    defaultProbability: 'medium',
    defaultImpact: 'medium',
    keywords: ['log tampering', 'log deletion', 'audit log', 'evidence destruction', 'log manipulation'],
    applicableControls: ['A.8.15', 'A.8.16', 'A.8.17'],
    mitigationSuggestions: [
      'Implement centralized log management',
      'Use write-once storage for logs',
      'Apply cryptographic verification of logs',
      'Restrict access to log files'
    ]
  },
  {
    id: 'THREAT-025',
    name: 'DNS Spoofing',
    nameJa: 'DNSスプーフィング',
    description: 'Manipulation of DNS responses to redirect users to malicious websites.',
    descriptionJa: 'ユーザーを悪意のあるWebサイトにリダイレクトするためのDNS応答の操作。',
    category: 'integrity',
    assetTypes: ['network', 'dns', 'server'],
    defaultProbability: 'medium',
    defaultImpact: 'high',
    keywords: ['DNS spoofing', 'DNS poisoning', 'DNS hijacking', 'DNS cache', 'pharming'],
    applicableControls: ['A.8.20', 'A.8.21', 'A.8.22'],
    mitigationSuggestions: [
      'Implement DNSSEC',
      'Use DNS over HTTPS (DoH) or TLS (DoT)',
      'Monitor DNS queries for anomalies',
      'Use trusted DNS resolvers'
    ]
  },
  {
    id: 'THREAT-026',
    name: 'Rootkit Installation',
    nameJa: 'ルートキットのインストール',
    description: 'Installation of malicious software designed to hide its presence and provide persistent unauthorized access.',
    descriptionJa: '存在を隠し、持続的な不正アクセスを提供するように設計された悪意のあるソフトウェアのインストール。',
    category: 'integrity',
    assetTypes: ['server', 'endpoint', 'operating system'],
    defaultProbability: 'low',
    defaultImpact: 'critical',
    keywords: ['rootkit', 'persistent threat', 'hidden malware', 'kernel rootkit', 'bootkit'],
    applicableControls: ['A.8.7', 'A.8.8', 'A.8.19', 'A.8.34'],
    mitigationSuggestions: [
      'Use secure boot and measured boot',
      'Deploy endpoint detection and response (EDR)',
      'Implement file integrity monitoring',
      'Regularly verify system integrity'
    ]
  },
  {
    id: 'THREAT-027',
    name: 'Firmware Attack',
    nameJa: 'ファームウェア攻撃',
    description: 'Compromise of device firmware to gain persistent low-level access and control.',
    descriptionJa: '持続的な低レベルアクセスと制御を得るためのデバイスファームウェアの侵害。',
    category: 'integrity',
    assetTypes: ['hardware', 'server', 'network', 'endpoint'],
    defaultProbability: 'low',
    defaultImpact: 'critical',
    keywords: ['firmware', 'BIOS', 'UEFI', 'hardware attack', 'low-level attack'],
    applicableControls: ['A.8.7', 'A.8.8', 'A.8.19', 'A.8.34'],
    mitigationSuggestions: [
      'Enable secure boot',
      'Keep firmware updated',
      'Verify firmware integrity',
      'Use hardware security modules where appropriate'
    ]
  },
  {
    id: 'THREAT-028',
    name: 'Cross-Site Request Forgery (CSRF)',
    nameJa: 'クロスサイトリクエストフォージェリ(CSRF)',
    description: 'Attack that forces authenticated users to submit unauthorized requests to a web application.',
    descriptionJa: '認証されたユーザーにWebアプリケーションへの不正なリクエストを送信させる攻撃。',
    category: 'integrity',
    assetTypes: ['web', 'application', 'browser'],
    defaultProbability: 'medium',
    defaultImpact: 'medium',
    keywords: ['CSRF', 'cross-site request forgery', 'session riding', 'one-click attack'],
    applicableControls: ['A.8.26', 'A.8.28', 'A.8.29'],
    mitigationSuggestions: [
      'Implement CSRF tokens',
      'Use SameSite cookie attribute',
      'Verify request origins',
      'Require re-authentication for sensitive actions'
    ]
  },
  {
    id: 'THREAT-029',
    name: 'File Inclusion Vulnerability',
    nameJa: 'ファイルインクルージョン脆弱性',
    description: 'Exploitation of improper file handling to include malicious files in application execution.',
    descriptionJa: '不適切なファイル処理を悪用して、アプリケーション実行に悪意のあるファイルを含める攻撃。',
    category: 'integrity',
    assetTypes: ['application', 'web', 'server'],
    defaultProbability: 'medium',
    defaultImpact: 'high',
    keywords: ['file inclusion', 'LFI', 'RFI', 'local file inclusion', 'remote file inclusion', 'path traversal'],
    applicableControls: ['A.8.26', 'A.8.28', 'A.8.29'],
    mitigationSuggestions: [
      'Validate and sanitize file paths',
      'Use allowlists for included files',
      'Disable remote file inclusion',
      'Implement proper file permissions'
    ]
  },
  {
    id: 'THREAT-030',
    name: 'Unauthorized Software Installation',
    nameJa: '不正なソフトウェアのインストール',
    description: 'Installation of unauthorized or untrusted software that may contain malicious code or vulnerabilities.',
    descriptionJa: '悪意のあるコードや脆弱性を含む可能性のある不正または信頼されていないソフトウェアのインストール。',
    category: 'integrity',
    assetTypes: ['endpoint', 'server', 'application'],
    defaultProbability: 'high',
    defaultImpact: 'medium',
    keywords: ['unauthorized software', 'shadow IT', 'unapproved application', 'rogue software'],
    applicableControls: ['A.8.7', 'A.8.19', 'A.8.32'],
    mitigationSuggestions: [
      'Implement application whitelisting',
      'Restrict administrative privileges',
      'Use software asset management',
      'Monitor for unauthorized installations'
    ]
  },

  // ============================================
  // AVAILABILITY THREATS (15 patterns)
  // ============================================
  {
    id: 'THREAT-031',
    name: 'Distributed Denial of Service (DDoS)',
    nameJa: '分散型サービス拒否攻撃(DDoS)',
    description: 'Overwhelming a system or network with traffic from multiple sources to make it unavailable.',
    descriptionJa: '複数のソースからのトラフィックでシステムやネットワークを圧倒し、利用不能にする攻撃。',
    category: 'availability',
    assetTypes: ['network', 'server', 'application', 'web'],
    defaultProbability: 'medium',
    defaultImpact: 'high',
    keywords: ['DDoS', 'denial of service', 'DoS', 'traffic flood', 'volumetric attack', 'botnet'],
    applicableControls: ['A.8.6', 'A.8.20', 'A.8.21', 'A.8.22'],
    mitigationSuggestions: [
      'Use DDoS protection services',
      'Implement rate limiting',
      'Deploy content delivery networks (CDN)',
      'Have incident response plan for DDoS'
    ]
  },
  {
    id: 'THREAT-032',
    name: 'Ransomware Attack',
    nameJa: 'ランサムウェア攻撃',
    description: 'Malware that encrypts data and demands payment for decryption keys.',
    descriptionJa: 'データを暗号化し、復号化キーの代金を要求するマルウェア。',
    category: 'availability',
    assetTypes: ['endpoint', 'server', 'storage', 'database'],
    defaultProbability: 'medium',
    defaultImpact: 'critical',
    keywords: ['ransomware', 'encryption', 'ransom', 'crypto malware', 'file encryption', 'extortion'],
    applicableControls: ['A.8.7', 'A.8.8', 'A.8.13', 'A.8.14'],
    mitigationSuggestions: [
      'Maintain regular offline backups',
      'Implement endpoint detection and response',
      'Segment networks to limit spread',
      'Train users to recognize phishing'
    ]
  },
  {
    id: 'THREAT-033',
    name: 'Hardware Failure',
    nameJa: 'ハードウェア障害',
    description: 'Failure of physical hardware components causing system or service outages.',
    descriptionJa: '物理的なハードウェアコンポーネントの故障によるシステムまたはサービスの停止。',
    category: 'availability',
    assetTypes: ['server', 'storage', 'network', 'hardware'],
    defaultProbability: 'high',
    defaultImpact: 'medium',
    keywords: ['hardware failure', 'disk failure', 'server crash', 'component failure', 'equipment malfunction'],
    applicableControls: ['A.7.11', 'A.7.12', 'A.8.6', 'A.8.14'],
    mitigationSuggestions: [
      'Implement redundant hardware configurations',
      'Use RAID for storage systems',
      'Maintain hardware maintenance contracts',
      'Monitor hardware health proactively'
    ]
  },
  {
    id: 'THREAT-034',
    name: 'Power Outage',
    nameJa: '停電',
    description: 'Loss of electrical power causing system and service unavailability.',
    descriptionJa: '電力の喪失によるシステムとサービスの利用不能。',
    category: 'availability',
    assetTypes: ['datacenter', 'server', 'facility', 'hardware'],
    defaultProbability: 'medium',
    defaultImpact: 'high',
    keywords: ['power outage', 'blackout', 'power failure', 'electrical failure', 'utility failure'],
    applicableControls: ['A.7.11', 'A.7.12', 'A.8.6', 'A.8.14'],
    mitigationSuggestions: [
      'Install uninterruptible power supplies (UPS)',
      'Implement backup generators',
      'Test power failover regularly',
      'Use geographically distributed systems'
    ]
  },
  {
    id: 'THREAT-035',
    name: 'Natural Disaster',
    nameJa: '自然災害',
    description: 'Natural events such as earthquakes, floods, or fires causing physical damage to IT infrastructure.',
    descriptionJa: '地震、洪水、火災などの自然現象によるITインフラへの物理的損害。',
    category: 'availability',
    assetTypes: ['datacenter', 'facility', 'hardware', 'server'],
    defaultProbability: 'low',
    defaultImpact: 'critical',
    keywords: ['natural disaster', 'earthquake', 'flood', 'fire', 'hurricane', 'tsunami', 'disaster'],
    applicableControls: ['A.5.29', 'A.5.30', 'A.7.4', 'A.7.5'],
    mitigationSuggestions: [
      'Implement disaster recovery plans',
      'Use geographically distributed data centers',
      'Maintain off-site backups',
      'Conduct regular disaster recovery tests'
    ]
  },
  {
    id: 'THREAT-036',
    name: 'Network Connectivity Loss',
    nameJa: 'ネットワーク接続の喪失',
    description: 'Loss of network connectivity due to equipment failure, ISP issues, or cable damage.',
    descriptionJa: '機器の故障、ISPの問題、またはケーブルの損傷によるネットワーク接続の喪失。',
    category: 'availability',
    assetTypes: ['network', 'server', 'communication'],
    defaultProbability: 'medium',
    defaultImpact: 'high',
    keywords: ['network outage', 'connectivity loss', 'ISP failure', 'network down', 'link failure'],
    applicableControls: ['A.8.6', 'A.8.14', 'A.8.20', 'A.8.21'],
    mitigationSuggestions: [
      'Implement redundant network connections',
      'Use multiple ISPs',
      'Deploy failover routing',
      'Monitor network connectivity continuously'
    ]
  },
  {
    id: 'THREAT-037',
    name: 'Application Crash',
    nameJa: 'アプリケーションクラッシュ',
    description: 'Unexpected termination of application due to bugs, memory leaks, or resource exhaustion.',
    descriptionJa: 'バグ、メモリリーク、またはリソース枯渇によるアプリケーションの予期しない終了。',
    category: 'availability',
    assetTypes: ['application', 'server', 'web'],
    defaultProbability: 'medium',
    defaultImpact: 'medium',
    keywords: ['application crash', 'crash', 'software failure', 'bug', 'memory leak', 'resource exhaustion'],
    applicableControls: ['A.8.25', 'A.8.27', 'A.8.29', 'A.8.32'],
    mitigationSuggestions: [
      'Implement robust error handling',
      'Conduct thorough testing',
      'Monitor application health and resources',
      'Implement automatic restart mechanisms'
    ]
  },
  {
    id: 'THREAT-038',
    name: 'Database Corruption',
    nameJa: 'データベース破損',
    description: 'Corruption of database files or data structures causing data loss or unavailability.',
    descriptionJa: 'データベースファイルやデータ構造の破損によるデータの喪失または利用不能。',
    category: 'availability',
    assetTypes: ['database', 'storage', 'server'],
    defaultProbability: 'low',
    defaultImpact: 'critical',
    keywords: ['database corruption', 'data corruption', 'database failure', 'storage corruption'],
    applicableControls: ['A.8.11', 'A.8.13', 'A.8.14', 'A.8.33'],
    mitigationSuggestions: [
      'Implement regular database backups',
      'Use database replication',
      'Monitor database integrity',
      'Test backup restoration procedures'
    ]
  },
  {
    id: 'THREAT-039',
    name: 'Resource Exhaustion',
    nameJa: 'リソース枯渇',
    description: 'Depletion of system resources (CPU, memory, disk) causing performance degradation or failure.',
    descriptionJa: 'システムリソース(CPU、メモリ、ディスク)の枯渇によるパフォーマンス低下または障害。',
    category: 'availability',
    assetTypes: ['server', 'application', 'cloud', 'database'],
    defaultProbability: 'medium',
    defaultImpact: 'medium',
    keywords: ['resource exhaustion', 'CPU overload', 'memory exhaustion', 'disk full', 'capacity'],
    applicableControls: ['A.8.6', 'A.8.14', 'A.8.34'],
    mitigationSuggestions: [
      'Implement capacity planning and monitoring',
      'Set up auto-scaling where possible',
      'Configure resource limits and quotas',
      'Alert on resource thresholds'
    ]
  },
  {
    id: 'THREAT-040',
    name: 'Vendor Service Outage',
    nameJa: 'ベンダーサービスの停止',
    description: 'Unavailability of third-party or cloud services that the organization depends on.',
    descriptionJa: '組織が依存するサードパーティまたはクラウドサービスの利用不能。',
    category: 'availability',
    assetTypes: ['cloud', 'vendor', 'api', 'application'],
    defaultProbability: 'medium',
    defaultImpact: 'high',
    keywords: ['vendor outage', 'cloud outage', 'service outage', 'third party failure', 'SaaS outage'],
    applicableControls: ['A.5.19', 'A.5.22', 'A.5.23', 'A.8.6'],
    mitigationSuggestions: [
      'Evaluate vendor SLAs and reliability',
      'Implement fallback solutions',
      'Monitor vendor service status',
      'Have contingency plans for critical vendors'
    ]
  },
  {
    id: 'THREAT-041',
    name: 'DNS Outage',
    nameJa: 'DNS障害',
    description: 'Unavailability of DNS services preventing name resolution and service access.',
    descriptionJa: 'DNSサービスの利用不能による名前解決とサービスアクセスの妨害。',
    category: 'availability',
    assetTypes: ['dns', 'network', 'server'],
    defaultProbability: 'low',
    defaultImpact: 'high',
    keywords: ['DNS outage', 'DNS failure', 'name resolution', 'DNS unavailable'],
    applicableControls: ['A.8.6', 'A.8.14', 'A.8.20'],
    mitigationSuggestions: [
      'Use multiple DNS providers',
      'Implement DNS caching',
      'Monitor DNS availability',
      'Have backup DNS configurations'
    ]
  },
  {
    id: 'THREAT-042',
    name: 'Certificate Expiration',
    nameJa: '証明書の期限切れ',
    description: 'Expiration of SSL/TLS certificates causing service disruption or security warnings.',
    descriptionJa: 'SSL/TLS証明書の期限切れによるサービス中断またはセキュリティ警告。',
    category: 'availability',
    assetTypes: ['web', 'application', 'server', 'api'],
    defaultProbability: 'high',
    defaultImpact: 'medium',
    keywords: ['certificate expiration', 'SSL expiry', 'TLS certificate', 'expired certificate'],
    applicableControls: ['A.8.24', 'A.8.34'],
    mitigationSuggestions: [
      'Implement certificate monitoring and alerting',
      'Use automated certificate renewal',
      'Maintain certificate inventory',
      'Set up calendar reminders for renewals'
    ]
  },
  {
    id: 'THREAT-043',
    name: 'Accidental Data Deletion',
    nameJa: '偶発的なデータ削除',
    description: 'Unintentional deletion of data by authorized users or administrators.',
    descriptionJa: '権限を持つユーザーまたは管理者による意図しないデータの削除。',
    category: 'availability',
    assetTypes: ['database', 'storage', 'document', 'cloud'],
    defaultProbability: 'medium',
    defaultImpact: 'high',
    keywords: ['accidental deletion', 'data loss', 'human error', 'mistaken deletion', 'user error'],
    applicableControls: ['A.8.10', 'A.8.13', 'A.8.14', 'A.8.33'],
    mitigationSuggestions: [
      'Implement soft delete with recovery period',
      'Maintain regular backups',
      'Use confirmation for destructive operations',
      'Implement role-based access controls'
    ]
  },
  {
    id: 'THREAT-044',
    name: 'Software Update Failure',
    nameJa: 'ソフトウェア更新の失敗',
    description: 'Failed software updates or patches causing system instability or downtime.',
    descriptionJa: 'ソフトウェアの更新やパッチの失敗によるシステムの不安定化またはダウンタイム。',
    category: 'availability',
    assetTypes: ['application', 'server', 'endpoint', 'operating system'],
    defaultProbability: 'medium',
    defaultImpact: 'medium',
    keywords: ['update failure', 'patch failure', 'upgrade failure', 'deployment failure', 'rollback'],
    applicableControls: ['A.8.8', 'A.8.19', 'A.8.32'],
    mitigationSuggestions: [
      'Test updates in staging environment',
      'Implement rollback procedures',
      'Have backup before updates',
      'Use phased deployment approach'
    ]
  },
  {
    id: 'THREAT-045',
    name: 'API Rate Limiting / Throttling',
    nameJa: 'APIレート制限/スロットリング',
    description: 'Service unavailability due to exceeding API rate limits or being throttled by providers.',
    descriptionJa: 'APIレート制限の超過またはプロバイダーによるスロットリングによるサービスの利用不能。',
    category: 'availability',
    assetTypes: ['api', 'application', 'cloud'],
    defaultProbability: 'medium',
    defaultImpact: 'medium',
    keywords: ['rate limiting', 'throttling', 'API limit', 'quota exceeded', 'request limit'],
    applicableControls: ['A.8.6', 'A.8.25', 'A.8.34'],
    mitigationSuggestions: [
      'Implement request caching',
      'Use exponential backoff for retries',
      'Monitor API usage patterns',
      'Negotiate higher rate limits if needed'
    ]
  }
]
