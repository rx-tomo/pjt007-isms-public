/**
 * ISO 27001:2022 Annex A Control Data
 *
 * Contains a representative subset of ISO 27001:2022 Annex A controls
 * for offline risk assessment fallback functionality.
 *
 * Control categories:
 * - A.5: Organizational controls
 * - A.6: People controls
 * - A.7: Physical controls
 * - A.8: Technological controls
 */

import type { IsoControl } from './IsmsKnowledgeBase'

export const ISO_CONTROLS: IsoControl[] = [
  // ========================================
  // A.5 Organizational controls
  // ========================================
  {
    id: 'A.5.1',
    title: 'Policies for information security',
    titleJa: '情報セキュリティのための方針群',
    description: 'Information security policy and topic-specific policies shall be defined, approved by management, published, communicated to and acknowledged by relevant personnel and relevant interested parties, and reviewed at planned intervals and if significant changes occur.',
    descriptionJa: '情報セキュリティ方針及びトピック固有の方針は、定義し、経営陣が承認し、発行し、関連する要員及び関連する利害関係者に伝達し、認識させ、計画した間隔で及び重大な変更が生じた場合にレビューしなければならない。',
    category: 'Organizational',
    subcategory: 'Policies',
    applicability: ['all', 'organization', 'management'],
    implementationGuidance: [
      'Develop and document information security policies',
      'Obtain management approval for policies',
      'Communicate policies to all relevant personnel',
      'Establish a review schedule for policies',
      'Ensure policies are accessible to all stakeholders'
    ],
    commonThreats: ['policy violation', 'unauthorized access', 'data breach', 'security incident', 'non-compliance'],
    commonVulnerabilities: ['lack of policy', 'outdated policies', 'poor communication', 'lack of awareness']
  },
  {
    id: 'A.5.2',
    title: 'Information security roles and responsibilities',
    titleJa: '情報セキュリティの役割及び責任',
    description: 'Information security roles and responsibilities shall be defined and allocated according to the organization needs.',
    descriptionJa: '情報セキュリティの役割及び責任は、組織のニーズに従って定義し、割り当てなければならない。',
    category: 'Organizational',
    subcategory: 'Governance',
    applicability: ['all', 'organization', 'management', 'personnel'],
    implementationGuidance: [
      'Define clear information security roles',
      'Assign responsibilities to specific individuals',
      'Document roles in job descriptions',
      'Ensure adequate resources for security functions',
      'Establish reporting lines for security matters'
    ],
    commonThreats: ['unauthorized access', 'security incident', 'misuse of assets'],
    commonVulnerabilities: ['unclear responsibilities', 'lack of accountability', 'inadequate resources']
  },
  {
    id: 'A.5.3',
    title: 'Segregation of duties',
    titleJa: '職務の分離',
    description: 'Conflicting duties and conflicting areas of responsibility shall be segregated.',
    descriptionJa: '相反する職務及び相反する責任範囲は、分離しなければならない。',
    category: 'Organizational',
    subcategory: 'Governance',
    applicability: ['all', 'financial', 'access control', 'operations'],
    implementationGuidance: [
      'Identify conflicting duties',
      'Implement separation of functions',
      'Use technical controls where manual segregation is not possible',
      'Document exceptions and compensating controls',
      'Regularly review segregation effectiveness'
    ],
    commonThreats: ['fraud', 'unauthorized access', 'data manipulation', 'insider threat'],
    commonVulnerabilities: ['combined duties', 'lack of oversight', 'excessive privileges']
  },
  {
    id: 'A.5.4',
    title: 'Management responsibilities',
    titleJa: '経営陣の責任',
    description: 'Management shall require all personnel to apply information security in accordance with the established information security policy, topic-specific policies and procedures of the organization.',
    descriptionJa: '経営陣は、組織の確立された情報セキュリティ方針、トピック固有の方針及び手順に従って情報セキュリティを適用することを、全ての要員に要求しなければならない。',
    category: 'Organizational',
    subcategory: 'Governance',
    applicability: ['all', 'management'],
    implementationGuidance: [
      'Set clear expectations for security behavior',
      'Lead by example in security practices',
      'Allocate adequate resources for security',
      'Support security initiatives',
      'Hold personnel accountable for security'
    ],
    commonThreats: ['non-compliance', 'security incident', 'policy violation'],
    commonVulnerabilities: ['lack of management support', 'insufficient resources', 'poor security culture']
  },
  {
    id: 'A.5.5',
    title: 'Contact with authorities',
    titleJa: '関係当局との連絡',
    description: 'The organization shall establish and maintain contact with relevant authorities.',
    descriptionJa: '組織は、関連する当局との連絡を確立し、維持しなければならない。',
    category: 'Organizational',
    subcategory: 'External Relations',
    applicability: ['all', 'legal', 'compliance', 'incident response'],
    implementationGuidance: [
      'Identify relevant authorities',
      'Establish contact procedures',
      'Maintain updated contact information',
      'Define when to contact authorities',
      'Document communication requirements'
    ],
    commonThreats: ['legal penalty', 'regulatory non-compliance', 'delayed incident response'],
    commonVulnerabilities: ['lack of authority contacts', 'unclear procedures', 'delayed reporting']
  },
  {
    id: 'A.5.7',
    title: 'Threat intelligence',
    titleJa: '脅威インテリジェンス',
    description: 'Information relating to information security threats shall be collected and analysed to produce threat intelligence.',
    descriptionJa: '情報セキュリティの脅威に関する情報は、脅威インテリジェンスを作成するために収集し、分析しなければならない。',
    category: 'Organizational',
    subcategory: 'Risk Management',
    applicability: ['all', 'security operations', 'risk management'],
    implementationGuidance: [
      'Subscribe to threat intelligence feeds',
      'Analyze threat information regularly',
      'Share relevant intelligence internally',
      'Update security controls based on threats',
      'Participate in information sharing groups'
    ],
    commonThreats: ['malware', 'advanced persistent threat', 'zero-day exploit', 'targeted attack'],
    commonVulnerabilities: ['lack of threat awareness', 'outdated threat information', 'poor analysis capability']
  },
  {
    id: 'A.5.8',
    title: 'Information security in project management',
    titleJa: 'プロジェクトマネジメントにおける情報セキュリティ',
    description: 'Information security shall be integrated into project management.',
    descriptionJa: '情報セキュリティは、プロジェクトマネジメントに統合しなければならない。',
    category: 'Organizational',
    subcategory: 'Project Management',
    applicability: ['all', 'projects', 'development'],
    implementationGuidance: [
      'Include security in project planning',
      'Conduct security risk assessments for projects',
      'Assign security responsibilities in projects',
      'Review security at project milestones',
      'Document security requirements'
    ],
    commonThreats: ['security vulnerability', 'insecure design', 'compliance failure'],
    commonVulnerabilities: ['security oversight', 'rushed delivery', 'lack of security expertise']
  },
  {
    id: 'A.5.15',
    title: 'Access control',
    titleJa: 'アクセス制御',
    description: 'Rules to control physical and logical access to information and other associated assets shall be established and implemented based on business and information security requirements.',
    descriptionJa: '情報及びその他の関連する資産への物理的及び論理的アクセスを制御するルールは、業務及び情報セキュリティの要求事項に基づいて確立し、実施しなければならない。',
    category: 'Organizational',
    subcategory: 'Access Control',
    applicability: ['all', 'systems', 'network', 'physical'],
    implementationGuidance: [
      'Define access control policy',
      'Implement role-based access control',
      'Regular access reviews',
      'Principle of least privilege',
      'Document access rights'
    ],
    commonThreats: ['unauthorized access', 'privilege escalation', 'data breach', 'insider threat'],
    commonVulnerabilities: ['excessive permissions', 'shared accounts', 'lack of access review']
  },

  // ========================================
  // A.6 People controls
  // ========================================
  {
    id: 'A.6.1',
    title: 'Screening',
    titleJa: '選考',
    description: 'Background verification checks on all candidates to become personnel shall be carried out prior to joining the organization and on an ongoing basis taking into consideration applicable laws, regulations and ethics and be proportional to the business requirements, the classification of the information to be accessed and the perceived risks.',
    descriptionJa: '要員になる全ての候補者に対する経歴確認のチェックは、適用される法律、規制及び倫理を考慮し、業務上の要求事項、アクセスされる情報の分類及び認識されたリスクに見合うものとして、組織に入る前及び継続的に実施しなければならない。',
    category: 'People',
    subcategory: 'Human Resources',
    applicability: ['all', 'personnel', 'contractors', 'employees'],
    implementationGuidance: [
      'Define screening requirements based on role',
      'Verify identity documents',
      'Check employment history',
      'Verify qualifications',
      'Conduct periodic re-screening'
    ],
    commonThreats: ['insider threat', 'fraud', 'unauthorized access', 'social engineering'],
    commonVulnerabilities: ['inadequate vetting', 'falsified credentials', 'lack of re-screening']
  },
  {
    id: 'A.6.2',
    title: 'Terms and conditions of employment',
    titleJa: '雇用条件',
    description: 'The employment contractual agreements shall state the personnel\'s and the organization\'s responsibilities for information security.',
    descriptionJa: '雇用契約書は、情報セキュリティについての要員の責任及び組織の責任を記載しなければならない。',
    category: 'People',
    subcategory: 'Human Resources',
    applicability: ['all', 'personnel', 'contractors', 'employees'],
    implementationGuidance: [
      'Include security clauses in contracts',
      'Define confidentiality obligations',
      'Specify acceptable use requirements',
      'Include post-employment obligations',
      'Ensure legal review of contracts'
    ],
    commonThreats: ['data breach', 'confidentiality breach', 'intellectual property theft'],
    commonVulnerabilities: ['weak contracts', 'unclear obligations', 'lack of enforcement']
  },
  {
    id: 'A.6.3',
    title: 'Information security awareness, education and training',
    titleJa: '情報セキュリティの意識向上、教育及び訓練',
    description: 'Personnel of the organization and relevant interested parties shall receive appropriate information security awareness, education and training and regular updates of the organization\'s information security policy, topic-specific policies and procedures, as relevant for their job function.',
    descriptionJa: '組織の要員及び関連する利害関係者は、その職務に関連するものとして、適切な情報セキュリティの意識向上、教育及び訓練、並びに組織の情報セキュリティ方針、トピック固有の方針及び手順についての定期的な更新情報を受けなければならない。',
    category: 'People',
    subcategory: 'Training',
    applicability: ['all', 'personnel', 'contractors', 'employees'],
    implementationGuidance: [
      'Develop security awareness program',
      'Provide role-based training',
      'Conduct regular refresher training',
      'Test awareness through simulations',
      'Track and measure training effectiveness'
    ],
    commonThreats: ['phishing', 'social engineering', 'human error', 'policy violation'],
    commonVulnerabilities: ['lack of awareness', 'untrained staff', 'security complacency']
  },
  {
    id: 'A.6.4',
    title: 'Disciplinary process',
    titleJa: '懲戒手続',
    description: 'A disciplinary process shall be formalized and communicated to take actions against personnel and other relevant interested parties who have committed an information security policy violation.',
    descriptionJa: '情報セキュリティ方針違反を犯した要員及び他の関連する利害関係者に対する措置を講じるために、懲戒手続を正式に定め、伝達しなければならない。',
    category: 'People',
    subcategory: 'Human Resources',
    applicability: ['all', 'personnel', 'management'],
    implementationGuidance: [
      'Define disciplinary procedures',
      'Ensure fair and consistent application',
      'Document all violations and actions',
      'Communicate process to all personnel',
      'Include escalation procedures'
    ],
    commonThreats: ['policy violation', 'security incident', 'negligence'],
    commonVulnerabilities: ['lack of consequences', 'inconsistent enforcement', 'poor documentation']
  },
  {
    id: 'A.6.5',
    title: 'Responsibilities after termination or change of employment',
    titleJa: '雇用の終了又は変更後の責任',
    description: 'Information security responsibilities and duties that remain valid after termination or change of employment shall be defined, enforced and communicated to relevant personnel and other interested parties.',
    descriptionJa: '雇用の終了又は変更後も有効な情報セキュリティの責任及び義務は、定義し、実施し、関連する要員及び他の利害関係者に伝達しなければならない。',
    category: 'People',
    subcategory: 'Human Resources',
    applicability: ['all', 'personnel', 'contractors', 'employees'],
    implementationGuidance: [
      'Define post-employment obligations',
      'Conduct exit interviews',
      'Recover all assets',
      'Revoke access rights promptly',
      'Remind of confidentiality obligations'
    ],
    commonThreats: ['data theft', 'unauthorized access', 'intellectual property theft'],
    commonVulnerabilities: ['lingering access', 'unreturned assets', 'unclear obligations']
  },
  {
    id: 'A.6.6',
    title: 'Confidentiality or non-disclosure agreements',
    titleJa: '秘密保持契約又は守秘義務契約',
    description: 'Confidentiality or non-disclosure agreements reflecting the organization\'s needs for the protection of information shall be identified, documented, regularly reviewed and signed by personnel and other relevant interested parties.',
    descriptionJa: '情報の保護に対する組織のニーズを反映した秘密保持契約又は守秘義務契約は、特定し、文書化し、定期的にレビューし、要員及び他の関連する利害関係者が署名しなければならない。',
    category: 'People',
    subcategory: 'Legal',
    applicability: ['all', 'personnel', 'contractors', 'third parties'],
    implementationGuidance: [
      'Develop NDA templates',
      'Ensure legal review',
      'Obtain signatures before access',
      'Review agreements regularly',
      'Maintain signed agreement records'
    ],
    commonThreats: ['confidentiality breach', 'data leak', 'intellectual property theft'],
    commonVulnerabilities: ['unsigned agreements', 'weak terms', 'lack of enforcement']
  },
  {
    id: 'A.6.7',
    title: 'Remote working',
    titleJa: 'リモートワーキング',
    description: 'Security measures shall be implemented when personnel are working remotely to protect information accessed, processed or stored outside the organization\'s premises.',
    descriptionJa: '要員がリモートで作業している場合、組織の施設の外でアクセスされ、処理され、又は保存される情報を保護するために、セキュリティ対策を実施しなければならない。',
    category: 'People',
    subcategory: 'Operations',
    applicability: ['all', 'remote workers', 'mobile devices', 'network'],
    implementationGuidance: [
      'Define remote working policy',
      'Secure home network requirements',
      'Use VPN for remote access',
      'Encrypt devices and data',
      'Provide security awareness for remote work'
    ],
    commonThreats: ['unauthorized access', 'data breach', 'eavesdropping', 'device theft'],
    commonVulnerabilities: ['insecure home networks', 'unencrypted data', 'shared devices']
  },
  {
    id: 'A.6.8',
    title: 'Information security event reporting',
    titleJa: '情報セキュリティ事象の報告',
    description: 'The organization shall provide a mechanism for personnel to report observed or suspected information security events through appropriate channels in a timely manner.',
    descriptionJa: '組織は、観測された又は疑われる情報セキュリティ事象を適切な経路を通じてタイムリーに報告するためのメカニズムを要員に提供しなければならない。',
    category: 'People',
    subcategory: 'Incident Management',
    applicability: ['all', 'personnel', 'security operations'],
    implementationGuidance: [
      'Establish reporting channels',
      'Provide clear reporting procedures',
      'Enable anonymous reporting',
      'Train personnel on what to report',
      'Acknowledge and respond to reports'
    ],
    commonThreats: ['delayed incident response', 'undetected breach', 'security incident'],
    commonVulnerabilities: ['fear of reporting', 'unclear procedures', 'lack of awareness']
  },

  // ========================================
  // A.7 Physical controls
  // ========================================
  {
    id: 'A.7.1',
    title: 'Physical security perimeters',
    titleJa: '物理的セキュリティ境界',
    description: 'Security perimeters shall be defined and used to protect areas that contain information and other associated assets.',
    descriptionJa: 'セキュリティ境界は、情報及びその他の関連する資産を含むエリアを保護するために、定義し、使用しなければならない。',
    category: 'Physical',
    subcategory: 'Perimeter Security',
    applicability: ['buildings', 'data centers', 'offices', 'facilities'],
    implementationGuidance: [
      'Define security zones',
      'Implement physical barriers',
      'Use access control systems',
      'Monitor entry points',
      'Secure external walls and windows'
    ],
    commonThreats: ['unauthorized entry', 'theft', 'vandalism', 'intrusion'],
    commonVulnerabilities: ['weak perimeter', 'unsecured entry points', 'poor monitoring']
  },
  {
    id: 'A.7.2',
    title: 'Physical entry',
    titleJa: '物理的入退',
    description: 'Secure areas shall be protected by appropriate entry controls and access points.',
    descriptionJa: 'セキュアエリアは、適切な入退管理及びアクセスポイントによって保護しなければならない。',
    category: 'Physical',
    subcategory: 'Access Control',
    applicability: ['buildings', 'data centers', 'secure areas', 'facilities'],
    implementationGuidance: [
      'Implement access control systems',
      'Use authentication mechanisms',
      'Log all entry and exit',
      'Escort visitors',
      'Regular review of access rights'
    ],
    commonThreats: ['unauthorized access', 'tailgating', 'intrusion', 'theft'],
    commonVulnerabilities: ['weak access controls', 'shared access cards', 'poor visitor management']
  },
  {
    id: 'A.7.3',
    title: 'Securing offices, rooms and facilities',
    titleJa: 'オフィス、部屋及び施設のセキュリティ',
    description: 'Physical security for offices, rooms and facilities shall be designed and implemented.',
    descriptionJa: 'オフィス、部屋及び施設の物理的セキュリティは、設計し、実施しなければならない。',
    category: 'Physical',
    subcategory: 'Facility Security',
    applicability: ['offices', 'server rooms', 'storage areas', 'facilities'],
    implementationGuidance: [
      'Lock offices when unattended',
      'Secure sensitive areas',
      'Use intrusion detection',
      'Control access to keys',
      'Regular security inspections'
    ],
    commonThreats: ['theft', 'unauthorized access', 'vandalism', 'corporate espionage'],
    commonVulnerabilities: ['unsecured offices', 'poor key management', 'lack of monitoring']
  },
  {
    id: 'A.7.4',
    title: 'Physical security monitoring',
    titleJa: '物理的セキュリティの監視',
    description: 'Premises shall be continuously monitored for unauthorized physical access.',
    descriptionJa: '施設は、許可されていない物理的アクセスについて継続的に監視しなければならない。',
    category: 'Physical',
    subcategory: 'Monitoring',
    applicability: ['buildings', 'data centers', 'facilities', 'secure areas'],
    implementationGuidance: [
      'Install CCTV cameras',
      'Use motion detection',
      'Monitor alarms 24/7',
      'Regular patrol rounds',
      'Retain monitoring records'
    ],
    commonThreats: ['intrusion', 'unauthorized access', 'theft', 'vandalism'],
    commonVulnerabilities: ['blind spots', 'inadequate monitoring', 'poor response procedures']
  },
  {
    id: 'A.7.5',
    title: 'Protecting against physical and environmental threats',
    titleJa: '物理的及び環境的脅威からの保護',
    description: 'Protection against physical and environmental threats, such as natural disasters and other intentional or unintentional physical threats to infrastructure shall be designed and implemented.',
    descriptionJa: '自然災害及びインフラストラクチャに対するその他の意図的又は意図しない物理的脅威のような、物理的及び環境的脅威からの保護は、設計し、実施しなければならない。',
    category: 'Physical',
    subcategory: 'Environmental',
    applicability: ['data centers', 'server rooms', 'facilities', 'infrastructure'],
    implementationGuidance: [
      'Assess environmental risks',
      'Install fire suppression systems',
      'Use water detection systems',
      'Implement temperature monitoring',
      'Plan for natural disasters'
    ],
    commonThreats: ['fire', 'flood', 'earthquake', 'power failure', 'natural disaster'],
    commonVulnerabilities: ['inadequate protection', 'poor environmental controls', 'lack of disaster planning']
  },
  {
    id: 'A.7.8',
    title: 'Equipment siting and protection',
    titleJa: '装置の設置及び保護',
    description: 'Equipment shall be sited securely and protected.',
    descriptionJa: '装置は、セキュアに設置し、保護しなければならない。',
    category: 'Physical',
    subcategory: 'Equipment',
    applicability: ['servers', 'network equipment', 'workstations', 'data centers'],
    implementationGuidance: [
      'Locate equipment in secure areas',
      'Protect from environmental hazards',
      'Secure cables and connections',
      'Control physical access to equipment',
      'Use equipment locks where appropriate'
    ],
    commonThreats: ['theft', 'tampering', 'environmental damage', 'unauthorized access'],
    commonVulnerabilities: ['exposed equipment', 'unsecured cables', 'poor environmental controls']
  },
  {
    id: 'A.7.10',
    title: 'Storage media',
    titleJa: '記憶媒体',
    description: 'Storage media shall be managed through their life cycle of acquisition, use, transportation and disposal in accordance with the organization\'s classification scheme and handling requirements.',
    descriptionJa: '記憶媒体は、組織の分類体系及び取扱い要求事項に従い、取得、使用、輸送及び処分のライフサイクルを通じて管理しなければならない。',
    category: 'Physical',
    subcategory: 'Media Handling',
    applicability: ['storage media', 'backup tapes', 'USB drives', 'hard drives'],
    implementationGuidance: [
      'Label and classify media',
      'Control media access',
      'Secure media storage',
      'Track media movement',
      'Securely dispose of media'
    ],
    commonThreats: ['data breach', 'theft', 'unauthorized access', 'data loss'],
    commonVulnerabilities: ['uncontrolled media', 'poor disposal', 'lack of tracking']
  },

  // ========================================
  // A.8 Technological controls
  // ========================================
  {
    id: 'A.8.1',
    title: 'User endpoint devices',
    titleJa: 'ユーザエンドポイントデバイス',
    description: 'Information stored on, processed by or accessible via user endpoint devices shall be protected.',
    descriptionJa: 'ユーザエンドポイントデバイスに保存され、処理され、又はアクセス可能な情報は、保護しなければならない。',
    category: 'Technological',
    subcategory: 'Endpoint Security',
    applicability: ['laptops', 'desktops', 'mobile devices', 'tablets', 'workstations'],
    implementationGuidance: [
      'Deploy endpoint protection software',
      'Implement device encryption',
      'Enforce screen lock policies',
      'Manage device configurations',
      'Enable remote wipe capabilities'
    ],
    commonThreats: ['malware', 'data breach', 'device theft', 'unauthorized access'],
    commonVulnerabilities: ['unpatched systems', 'weak passwords', 'unencrypted data', 'missing security software']
  },
  {
    id: 'A.8.2',
    title: 'Privileged access rights',
    titleJa: '特権的アクセス権',
    description: 'The allocation and use of privileged access rights shall be restricted and managed.',
    descriptionJa: '特権的アクセス権の割当て及び利用は、制限し、管理しなければならない。',
    category: 'Technological',
    subcategory: 'Access Control',
    applicability: ['systems', 'applications', 'databases', 'network', 'administrator accounts'],
    implementationGuidance: [
      'Identify privileged accounts',
      'Implement just-in-time access',
      'Use privileged access management',
      'Monitor privileged activities',
      'Regular review of privileges'
    ],
    commonThreats: ['privilege escalation', 'unauthorized access', 'insider threat', 'account compromise'],
    commonVulnerabilities: ['excessive privileges', 'shared admin accounts', 'poor monitoring']
  },
  {
    id: 'A.8.3',
    title: 'Information access restriction',
    titleJa: '情報へのアクセス制限',
    description: 'Access to information and other associated assets shall be restricted in accordance with the established topic-specific policy on access control.',
    descriptionJa: '情報及びその他の関連する資産へのアクセスは、確立されたアクセス制御に関するトピック固有の方針に従って制限しなければならない。',
    category: 'Technological',
    subcategory: 'Access Control',
    applicability: ['systems', 'applications', 'data', 'files', 'databases'],
    implementationGuidance: [
      'Implement access controls',
      'Use role-based access',
      'Enforce need-to-know principle',
      'Regular access reviews',
      'Log access attempts'
    ],
    commonThreats: ['unauthorized access', 'data breach', 'privilege abuse'],
    commonVulnerabilities: ['overly permissive access', 'lack of controls', 'poor review process']
  },
  {
    id: 'A.8.5',
    title: 'Secure authentication',
    titleJa: 'セキュリティを保った認証',
    description: 'Secure authentication technologies and procedures shall be implemented based on information access restrictions and the topic-specific policy on access control.',
    descriptionJa: 'セキュリティを保った認証技術及び手順は、情報アクセス制限及びアクセス制御に関するトピック固有の方針に基づいて実施しなければならない。',
    category: 'Technological',
    subcategory: 'Authentication',
    applicability: ['systems', 'applications', 'network', 'user accounts'],
    implementationGuidance: [
      'Implement strong password policies',
      'Use multi-factor authentication',
      'Protect authentication credentials',
      'Implement session management',
      'Monitor authentication failures'
    ],
    commonThreats: ['credential theft', 'brute force attack', 'unauthorized access', 'account compromise'],
    commonVulnerabilities: ['weak passwords', 'single-factor auth', 'credential reuse']
  },
  {
    id: 'A.8.7',
    title: 'Protection against malware',
    titleJa: 'マルウェアに対する保護',
    description: 'Protection against malware shall be implemented and supported by appropriate user awareness.',
    descriptionJa: 'マルウェアに対する保護は、適切なユーザの意識向上に支援されて、実施しなければならない。',
    category: 'Technological',
    subcategory: 'Malware Protection',
    applicability: ['endpoints', 'servers', 'network', 'email', 'web'],
    implementationGuidance: [
      'Deploy anti-malware software',
      'Keep signatures updated',
      'Scan incoming files',
      'Block malicious websites',
      'Train users on malware risks'
    ],
    commonThreats: ['malware', 'ransomware', 'virus', 'trojan', 'worm'],
    commonVulnerabilities: ['outdated signatures', 'disabled protection', 'user behavior']
  },
  {
    id: 'A.8.8',
    title: 'Management of technical vulnerabilities',
    titleJa: '技術的ぜい弱性の管理',
    description: 'Information about technical vulnerabilities of information systems in use shall be obtained, the organization\'s exposure to such vulnerabilities shall be evaluated and appropriate measures shall be taken.',
    descriptionJa: '使用中の情報システムの技術的ぜい弱性に関する情報は、入手し、そのようなぜい弱性に対する組織の露出を評価し、適切な措置を講じなければならない。',
    category: 'Technological',
    subcategory: 'Vulnerability Management',
    applicability: ['systems', 'applications', 'network', 'software'],
    implementationGuidance: [
      'Conduct regular vulnerability scans',
      'Subscribe to vulnerability alerts',
      'Prioritize patches by risk',
      'Test patches before deployment',
      'Track remediation progress'
    ],
    commonThreats: ['exploitation', 'zero-day attack', 'system compromise', 'data breach'],
    commonVulnerabilities: ['unpatched systems', 'delayed patching', 'unknown vulnerabilities']
  },
  {
    id: 'A.8.9',
    title: 'Configuration management',
    titleJa: '構成管理',
    description: 'Configurations, including security configurations, of hardware, software, services and networks shall be established, documented, implemented, monitored and reviewed.',
    descriptionJa: 'ハードウェア、ソフトウェア、サービス及びネットワークの、セキュリティ構成を含む構成は、確立し、文書化し、実施し、監視し、レビューしなければならない。',
    category: 'Technological',
    subcategory: 'Configuration',
    applicability: ['systems', 'applications', 'network', 'servers', 'devices'],
    implementationGuidance: [
      'Define security baselines',
      'Document configurations',
      'Use configuration management tools',
      'Monitor for configuration drift',
      'Regular configuration reviews'
    ],
    commonThreats: ['misconfiguration', 'unauthorized changes', 'security weakness'],
    commonVulnerabilities: ['default configurations', 'undocumented changes', 'configuration drift']
  },
  {
    id: 'A.8.11',
    title: 'Data masking',
    titleJa: 'データマスキング',
    description: 'Data masking shall be used in accordance with the organization\'s topic-specific policy on access control and other related topic-specific policies, and business requirements, taking applicable legislation into consideration.',
    descriptionJa: 'データマスキングは、組織のアクセス制御に関するトピック固有の方針及び他の関連するトピック固有の方針、並びに適用される法律を考慮した業務上の要求事項に従って使用しなければならない。',
    category: 'Technological',
    subcategory: 'Data Protection',
    applicability: ['databases', 'applications', 'testing', 'development', 'sensitive data'],
    implementationGuidance: [
      'Identify sensitive data fields',
      'Define masking rules',
      'Apply masking in non-production',
      'Validate masking effectiveness',
      'Document masking procedures'
    ],
    commonThreats: ['data exposure', 'privacy breach', 'unauthorized access'],
    commonVulnerabilities: ['exposed data in testing', 'weak masking', 'real data in dev']
  },
  {
    id: 'A.8.12',
    title: 'Data leakage prevention',
    titleJa: 'データ漏えい防止',
    description: 'Data leakage prevention measures shall be applied to systems, networks and any other devices that process, store or transmit sensitive information.',
    descriptionJa: 'データ漏えい防止対策は、センシティブな情報を処理、保存又は送信するシステム、ネットワーク及びその他のあらゆるデバイスに適用しなければならない。',
    category: 'Technological',
    subcategory: 'Data Protection',
    applicability: ['endpoints', 'network', 'email', 'cloud', 'sensitive data'],
    implementationGuidance: [
      'Deploy DLP solutions',
      'Define sensitive data policies',
      'Monitor data movement',
      'Block unauthorized transfers',
      'Alert on policy violations'
    ],
    commonThreats: ['data exfiltration', 'data breach', 'insider threat', 'accidental disclosure'],
    commonVulnerabilities: ['unmonitored channels', 'weak controls', 'user behavior']
  },
  {
    id: 'A.8.14',
    title: 'Redundancy of information processing facilities',
    titleJa: '情報処理施設の冗長性',
    description: 'Information processing facilities shall be implemented with redundancy sufficient to meet availability requirements.',
    descriptionJa: '情報処理施設は、可用性要求事項を満たすのに十分な冗長性をもって実施しなければならない。',
    category: 'Technological',
    subcategory: 'Business Continuity',
    applicability: ['data centers', 'servers', 'network', 'infrastructure'],
    implementationGuidance: [
      'Identify critical systems',
      'Implement failover solutions',
      'Use load balancing',
      'Test failover regularly',
      'Monitor system availability'
    ],
    commonThreats: ['service disruption', 'system failure', 'single point of failure'],
    commonVulnerabilities: ['lack of redundancy', 'untested failover', 'insufficient capacity']
  },
  {
    id: 'A.8.15',
    title: 'Logging',
    titleJa: 'ログ取得',
    description: 'Logs that record activities, exceptions, faults and other relevant events shall be produced, stored, protected and analysed.',
    descriptionJa: 'アクティビティ、例外、障害及びその他の関連する事象を記録するログは、作成し、保存し、保護し、分析しなければならない。',
    category: 'Technological',
    subcategory: 'Monitoring',
    applicability: ['systems', 'applications', 'network', 'security', 'databases'],
    implementationGuidance: [
      'Define logging requirements',
      'Configure comprehensive logging',
      'Centralize log storage',
      'Protect log integrity',
      'Analyze logs regularly'
    ],
    commonThreats: ['undetected breach', 'forensic failure', 'compliance violation'],
    commonVulnerabilities: ['inadequate logging', 'log tampering', 'lack of analysis']
  },
  {
    id: 'A.8.16',
    title: 'Monitoring activities',
    titleJa: '監視活動',
    description: 'Networks, systems and applications shall be monitored for anomalous behaviour and appropriate actions taken to evaluate potential information security incidents.',
    descriptionJa: 'ネットワーク、システム及びアプリケーションは、異常な挙動がないか監視し、潜在的な情報セキュリティインシデントを評価するための適切な措置を講じなければならない。',
    category: 'Technological',
    subcategory: 'Monitoring',
    applicability: ['network', 'systems', 'applications', 'security operations'],
    implementationGuidance: [
      'Implement monitoring tools',
      'Define alert thresholds',
      'Establish response procedures',
      'Use behavioral analysis',
      'Monitor 24/7 for critical systems'
    ],
    commonThreats: ['undetected attack', 'prolonged breach', 'advanced persistent threat'],
    commonVulnerabilities: ['lack of monitoring', 'alert fatigue', 'delayed response']
  },
  {
    id: 'A.8.20',
    title: 'Networks security',
    titleJa: 'ネットワークのセキュリティ',
    description: 'Networks and network devices shall be secured, managed and controlled to protect information in systems and applications.',
    descriptionJa: 'ネットワーク及びネットワークデバイスは、システム及びアプリケーションの情報を保護するために、セキュリティを保ち、管理し、制御しなければならない。',
    category: 'Technological',
    subcategory: 'Network Security',
    applicability: ['network', 'routers', 'switches', 'firewalls', 'infrastructure'],
    implementationGuidance: [
      'Implement network segmentation',
      'Deploy firewalls',
      'Secure network devices',
      'Monitor network traffic',
      'Regular security assessments'
    ],
    commonThreats: ['network intrusion', 'unauthorized access', 'denial of service', 'eavesdropping'],
    commonVulnerabilities: ['flat networks', 'weak firewall rules', 'unsecured devices']
  },
  {
    id: 'A.8.21',
    title: 'Security of network services',
    titleJa: 'ネットワークサービスのセキュリティ',
    description: 'Security mechanisms, service levels and service requirements of network services shall be identified, implemented and monitored.',
    descriptionJa: 'ネットワークサービスのセキュリティメカニズム、サービスレベル及びサービス要求事項は、特定し、実施し、監視しなければならない。',
    category: 'Technological',
    subcategory: 'Network Security',
    applicability: ['network services', 'cloud services', 'internet', 'VPN'],
    implementationGuidance: [
      'Define service requirements',
      'Implement security controls',
      'Monitor service performance',
      'Review service agreements',
      'Test security regularly'
    ],
    commonThreats: ['service disruption', 'data interception', 'unauthorized access'],
    commonVulnerabilities: ['insecure services', 'weak agreements', 'poor monitoring']
  },
  {
    id: 'A.8.24',
    title: 'Use of cryptography',
    titleJa: '暗号の使用',
    description: 'Rules for the effective use of cryptography, including cryptographic key management, shall be defined and implemented.',
    descriptionJa: '暗号鍵の管理を含む、暗号の効果的な使用のためのルールは、定義し、実施しなければならない。',
    category: 'Technological',
    subcategory: 'Cryptography',
    applicability: ['data at rest', 'data in transit', 'systems', 'applications', 'communications'],
    implementationGuidance: [
      'Define cryptographic policy',
      'Select appropriate algorithms',
      'Implement key management',
      'Protect cryptographic keys',
      'Regular key rotation'
    ],
    commonThreats: ['data interception', 'data breach', 'cryptographic attack'],
    commonVulnerabilities: ['weak encryption', 'poor key management', 'outdated algorithms']
  },
  {
    id: 'A.8.25',
    title: 'Secure development life cycle',
    titleJa: 'セキュリティに配慮した開発のライフサイクル',
    description: 'Rules for the secure development of software and systems shall be established and applied.',
    descriptionJa: 'ソフトウェア及びシステムのセキュリティに配慮した開発のためのルールは、確立し、適用しなければならない。',
    category: 'Technological',
    subcategory: 'Development',
    applicability: ['software development', 'applications', 'systems', 'custom code'],
    implementationGuidance: [
      'Define secure coding standards',
      'Conduct security design reviews',
      'Perform code reviews',
      'Test security throughout SDLC',
      'Train developers on security'
    ],
    commonThreats: ['security vulnerability', 'injection attack', 'insecure design'],
    commonVulnerabilities: ['coding errors', 'design flaws', 'untested code']
  },
  {
    id: 'A.8.26',
    title: 'Application security requirements',
    titleJa: 'アプリケーションのセキュリティ要求事項',
    description: 'Information security requirements shall be identified, specified and approved when developing or acquiring applications.',
    descriptionJa: '情報セキュリティ要求事項は、アプリケーションを開発又は取得する際に、特定し、明示し、承認しなければならない。',
    category: 'Technological',
    subcategory: 'Development',
    applicability: ['applications', 'software', 'procurement', 'development'],
    implementationGuidance: [
      'Define security requirements',
      'Include security in procurement',
      'Review application security',
      'Test against requirements',
      'Document security features'
    ],
    commonThreats: ['insecure application', 'data breach', 'unauthorized access'],
    commonVulnerabilities: ['missing requirements', 'insufficient testing', 'weak specifications']
  },
  {
    id: 'A.8.28',
    title: 'Secure coding',
    titleJa: 'セキュリティに配慮したコーディング',
    description: 'Secure coding principles shall be applied to software development.',
    descriptionJa: 'セキュリティに配慮したコーディングの原則は、ソフトウェア開発に適用しなければならない。',
    category: 'Technological',
    subcategory: 'Development',
    applicability: ['software development', 'applications', 'custom code', 'web applications'],
    implementationGuidance: [
      'Follow secure coding guidelines',
      'Validate all inputs',
      'Handle errors securely',
      'Use security libraries',
      'Avoid common vulnerabilities'
    ],
    commonThreats: ['sql injection', 'cross-site scripting', 'buffer overflow', 'injection attack'],
    commonVulnerabilities: ['input validation', 'error handling', 'insecure functions']
  },
  {
    id: 'A.8.29',
    title: 'Security testing in development and acceptance',
    titleJa: '開発及び受入れにおけるセキュリティ試験',
    description: 'Security testing processes shall be defined and implemented in the development life cycle.',
    descriptionJa: 'セキュリティ試験プロセスは、開発のライフサイクルにおいて定義し、実施しなければならない。',
    category: 'Technological',
    subcategory: 'Development',
    applicability: ['software development', 'testing', 'applications', 'systems'],
    implementationGuidance: [
      'Define security test requirements',
      'Perform vulnerability scanning',
      'Conduct penetration testing',
      'Test authentication and authorization',
      'Include security in acceptance criteria'
    ],
    commonThreats: ['undetected vulnerability', 'security weakness', 'exploitation'],
    commonVulnerabilities: ['insufficient testing', 'missed vulnerabilities', 'weak test coverage']
  },
  {
    id: 'A.8.31',
    title: 'Separation of development, test and production environments',
    titleJa: '開発環境、試験環境及び本番環境の分離',
    description: 'Development, testing and production environments shall be separated and secured.',
    descriptionJa: '開発環境、試験環境及び本番環境は、分離し、セキュリティを保たなければならない。',
    category: 'Technological',
    subcategory: 'Development',
    applicability: ['environments', 'development', 'testing', 'production', 'infrastructure'],
    implementationGuidance: [
      'Separate environments physically or logically',
      'Restrict access between environments',
      'Use different credentials',
      'Control data movement',
      'Document environment configurations'
    ],
    commonThreats: ['production impact', 'data exposure', 'unauthorized changes'],
    commonVulnerabilities: ['shared environments', 'weak separation', 'production data in testing']
  },
  {
    id: 'A.8.32',
    title: 'Change management',
    titleJa: '変更管理',
    description: 'Changes to information processing facilities and information systems shall be subject to change management procedures.',
    descriptionJa: '情報処理施設及び情報システムへの変更は、変更管理手順に従わなければならない。',
    category: 'Technological',
    subcategory: 'Operations',
    applicability: ['systems', 'applications', 'infrastructure', 'network', 'configurations'],
    implementationGuidance: [
      'Define change management process',
      'Assess change impact',
      'Obtain appropriate approvals',
      'Test changes before implementation',
      'Document all changes'
    ],
    commonThreats: ['service disruption', 'security weakness', 'unauthorized changes'],
    commonVulnerabilities: ['uncontrolled changes', 'untested changes', 'poor documentation']
  },
  {
    id: 'A.8.34',
    title: 'Protection of information systems during audit testing',
    titleJa: '監査試験中の情報システムの保護',
    description: 'Audit tests and other assurance activities involving assessment of operational systems shall be planned and agreed between the tester and appropriate management.',
    descriptionJa: '運用システムの評価を伴う監査試験及びその他の保証活動は、試験者と適切な経営陣との間で計画し、合意しなければならない。',
    category: 'Technological',
    subcategory: 'Audit',
    applicability: ['systems', 'applications', 'audit', 'testing', 'production'],
    implementationGuidance: [
      'Plan audit activities',
      'Coordinate with operations',
      'Minimize disruption',
      'Protect production data',
      'Document audit scope'
    ],
    commonThreats: ['service disruption', 'data exposure', 'system impact'],
    commonVulnerabilities: ['uncoordinated testing', 'production impact', 'data exposure']
  }
]
