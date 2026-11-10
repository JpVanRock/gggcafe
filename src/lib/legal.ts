/**
 * Terms of Service, the Privacy & Security Notice, and the short disclaimers shown around the site
 * (docs/features/legal.md). One place for the words so the pages, the footer, sign-up and the
 * agreement page always say the same thing.
 *
 * Changing the Terms or the notice in a way people should agree to again: bump TERMS_VERSION (the
 * date the new version takes effect). Everyone signed in is asked to agree again (src/proxy.ts sends
 * them to /terms/accept); each agreement is recorded in public.terms_acceptances.
 */

/** The version people agree to: the date it took effect (YYYY-MM-DD). */
export const TERMS_VERSION = "2026-11-09";

/** Shown at the top of both documents. */
export const EFFECTIVE_DATE = "November 9, 2026";

/** Who runs GGG.Cafe, whose law applies, and where to reach us (user, 2026-11-09). */
export const LEGAL = {
  /** how the documents name the service */
  name: "GGG.Cafe",
  /** the company that owns and operates it: the party to the Terms and the copyright holder */
  owner: "GMI Digital LLC",
  /** the state whose law governs the Terms, and the county where a court case would be filed */
  state: "Pennsylvania",
  county: "Northampton",
  /** where people send legal and privacy questions, and requests to see or delete information */
  contact: "info@gmidigital.io",
};

/** The footer's copyright line. */
export const COPYRIGHT = `© 2026 ${LEGAL.owner}. All rights reserved.`;

/** A paragraph, or a bulleted list when it's an array. */
export type LegalBlock = string | string[];
export type LegalSection = {
  id: string;
  title: string;
  blocks: LegalBlock[];
  /** set in bold so it stands out (warranty disclaimer, limits of liability, release) */
  conspicuous?: boolean;
};

const contactLine = `Email ${LEGAL.contact}, or ask your team's head coach to pass your message to a GGG.Cafe admin.`;

export const TERMS_INTRO = [
  `These Terms of Service ("Terms") are a binding agreement between you and ${LEGAL.owner}, which owns and operates ${LEGAL.name} ("${LEGAL.name}," "we," "us"). They cover the ${LEGAL.name} website, the app you can add to your phone's home screen, and everything on them (together, the "Service").`,
  "Please read them carefully. They include an assumption of risk and a release of claims (section 4), a disclaimer of warranties (section 13), limits on our liability (section 14) and a waiver of class actions (section 17).",
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: "agreeing",
    title: "Agreeing to these Terms",
    blocks: [
      "You accept these Terms when you create an account, check the box agreeing to them, or use the Service. If you don't agree, don't use the Service.",
      "If you're under 18, your parent or legal guardian must read and agree to these Terms for you. A parent or guardian who lets a minor use the Service agrees to these Terms on the minor's behalf and on their own, and is responsible for the minor's use, including the assumption of risk, the release and the indemnity below.",
      "Children under 13 can't create their own account. Their parent or guardian makes the player's login from the family page, which gives the consent described in our Privacy & Security Notice.",
    ],
  },
  {
    id: "service",
    title: "What GGG.Cafe is",
    blocks: [
      "GGG.Cafe is a softball player-development and team-management tool. Coaches use it to organize teams, practices and games; players use it to track their training, goals and progress; parents and mentors use it to support them.",
      "GGG.Cafe is an online tool. It is not a coach, trainer, doctor, league or governing body. We don't run or supervise any practice, game, workout or training session, and we don't employ the coaches, mentors or other people who use the Service.",
      "When a coach or admin approves an account, that only lets the person use the Service. It is not a background check, certification or endorsement of that person.",
    ],
  },
  {
    id: "account",
    title: "Your account",
    blocks: [
      "Give accurate information and keep it current. Keep your password private: you're responsible for everything done with your account. Tell your coach or us right away if you think someone else has used it.",
      "Team codes are for the people a coach invites. Don't post or share them publicly.",
      "We, and the coaches and admins who approve accounts, can decline, limit, suspend or remove any account at any time, including for breaking these Terms.",
    ],
  },
  {
    id: "risk",
    title: "Physical activity: assumption of risk and release",
    conspicuous: true,
    blocks: [
      'Softball and the training on GGG.Cafe are physical activities with real risk. The Service includes, and lets users add, drills, workouts, conditioning, strength and speed work, throwing, pitching, catching and hitting programs, stretching, movement exercises, fitness tests, practice plans and training routines (together, "Training Content"). Some Training Content is written by GGG.Cafe; much of it is added by coaches, mentors, players and parents.',
      "Taking part can cause injury, including sprains, strains, fractures, concussions, overuse injuries (for example to the arm or shoulder), heat illness, cardiac events, permanent disability and, in rare cases, death.",
      "Training Content is general information. It isn't tailored to you, it isn't medical or professional advice, and we don't review or verify what users add. You decide whether, how and how hard to train.",
      [
        "Get clearance from a physician before starting any training program, and again after an injury or illness.",
        "Warm up, use proper technique and the right equipment, and train on a safe surface.",
        "Train under the supervision of a qualified adult. Minors should always be supervised.",
        "Follow your league's pitch-count and rest rules, rest between hard sessions, and stay hydrated.",
        "Stop right away if you feel pain, dizziness, chest pain or shortness of breath, and get medical help.",
      ],
      "YOU USE ALL TRAINING CONTENT AT YOUR OWN RISK. You voluntarily assume all risks, known and unknown, of injury, illness, death and damage to property from any activity you do based on, or in connection with, the Service.",
      `Release: to the fullest extent the law allows, you (and, for a minor, the parent or guardian, on the minor's behalf and on their own) release, waive and agree not to sue ${LEGAL.owner}, ${LEGAL.name}, and their members, managers, owners, employees, agents, administrators, volunteers, contributors, successors and assigns (the "GGG.Cafe Parties") over any injury, illness, death, loss or damage connected to Training Content or any activity connected to the Service, including claims based on the negligence of the GGG.Cafe Parties. This release does not cover gross negligence, recklessness, intentional misconduct, or anything else the law doesn't allow to be released.`,
      "If the law doesn't let a parent or guardian release a minor's own claims, the parent or guardian still releases their own claims (for example, for medical expenses) to the same extent, and the indemnity in section 15 still applies.",
      "Coaches and the organizations that run practices and training are responsible for supervising them, for checking that each drill and workout suits their players' age, health and ability, and for following their league's safety rules.",
    ],
  },
  {
    id: "advice",
    title: "Not medical, mental-health or professional advice",
    blocks: [
      "Nothing on the Service is medical, psychological or other professional advice, diagnosis or treatment. That includes training, recovery, nutrition, mental-game tools, guided sessions, journals and movement or hitting-style profiles. Ask a qualified professional about your health.",
      "Mental-game tools are for focus and confidence in sport. They aren't counseling or therapy. If you or someone you know is struggling or in crisis, call or text 988 (the Suicide & Crisis Lifeline in the U.S.). If someone is in danger, call 911.",
      "Medical cards help coaches in an emergency. They don't replace calling 911 or getting medical care. Parents are responsible for keeping them complete and current.",
    ],
  },
  {
    id: "content",
    title: "Content you add",
    blocks: [
      'You\'re responsible for what you add: routines, drills, practice plans, notes, goals, journal entries, messages, photos, stats and anything else ("User Content"). Only add what you have the right to share, and only share someone else\'s photo or personal information with their permission (a parent\'s permission for a minor).',
      "You keep ownership of your User Content. You give GGG.Cafe a non-exclusive, royalty-free license to store, copy, display and process it only to run the Service for the people your role and team allow to see it.",
      "We don't review User Content before it appears and we don't endorse it. We can remove any content at any time.",
    ],
  },
  {
    id: "rewards",
    title: "Points, badges and awards are for fun",
    blocks: [
      'Points, ranks, leaderboards, Player of the Week, badges, trophies, rings, Golden Gloves, MVP badges, certificates, the Leader Badge and every other award or reward on the Service ("Rewards") are for fun, motivation and illustration only.',
      "Rewards have no cash or monetary value. They can't be redeemed, sold, traded or transferred, and they aren't prizes, scholarships or official honors. They aren't an official ranking, evaluation or recruiting assessment from any team, league, school or college.",
      "We can change, recalculate, reset or remove Rewards at any time.",
    ],
  },
  {
    id: "rules",
    title: "Rules for using GGG.Cafe",
    blocks: [
      [
        "Treat everyone with respect: no bullying, harassment, threats, hate or sexual content.",
        "Don't pretend to be someone else or use someone else's account.",
        "Don't share team codes, or other people's information, photos or messages, beyond the people allowed to see them.",
        "Don't try to get into accounts, information or parts of the Service you aren't allowed to see, and don't test, probe or get around its security.",
        "Don't upload viruses or harmful code, and don't copy, scrape or overload the Service.",
        "Don't use the Service for anything illegal or for advertising.",
      ],
      "Coaches and admins can remove content and accounts that break these rules. If you see something wrong, tell a coach or contact us.",
    ],
  },
  {
    id: "privacy",
    title: "Privacy and data security",
    blocks: [
      "Our Privacy & Security Notice explains what information we collect, who can see it and how we protect it. It is part of these Terms.",
      "We use reasonable administrative, technical and physical safeguards. No website, app or database is completely secure, though, and we can't guarantee that information will never be accessed, changed, lost or disclosed without permission. To the extent the law allows, you use the Service and send information to it at your own risk.",
      "Protect your account: use a strong password you don't use anywhere else, don't share it, sign out on shared devices, and keep your phone and computer up to date. Tell us right away if you think your account or information has been misused.",
      "If a security incident affects your personal information, we'll notify you, and others, as the law requires.",
      "Keep your own copies of anything important. We can't promise the Service will never lose information.",
    ],
  },
  {
    id: "ownership",
    title: "Our content and paid content",
    blocks: [
      `The Service and what we provide on it (text, lessons, chapters, quizzes, graphics, the GGG.Cafe name and logos, and the Elevate Together artwork) belong to ${LEGAL.owner} or its licensors and are protected by copyright and trademark law.`,
      "You may use it only for your own and your team's development through the Service. Don't copy, share, sell, publish or make other works from it. Paid or advanced content is licensed only to the accounts it's unlocked for.",
    ],
  },
  {
    id: "providers",
    title: "Other services",
    blocks: [
      "The Service runs on outside providers for hosting, the database, sign-in, file storage and email. Their services can be interrupted, and we aren't responsible for them. Links to other websites are for convenience; we don't control or endorse those sites.",
    ],
  },
  {
    id: "changes-service",
    title: "Changes and availability",
    blocks: [
      "We can change, suspend or stop any part of the Service at any time, with or without notice. We don't promise the Service will always be available, on time or free of errors.",
    ],
  },
  {
    id: "warranties",
    title: "Disclaimer of warranties",
    conspicuous: true,
    blocks: [
      'TO THE FULLEST EXTENT THE LAW ALLOWS, THE SERVICE, ALL TRAINING CONTENT AND ALL OTHER CONTENT ARE PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, SAFETY, SECURITY AND NON-INFRINGEMENT.',
      "WE DON'T WARRANT THAT ANY DRILL, WORKOUT OR OTHER CONTENT IS SAFE OR RIGHT FOR YOU, OR THAT THE SERVICE WILL BE SECURE, UNINTERRUPTED, OR FREE OF ERRORS OR HARMFUL CODE.",
    ],
  },
  {
    id: "liability",
    title: "Limits on our liability",
    conspicuous: true,
    blocks: [
      "TO THE FULLEST EXTENT THE LAW ALLOWS, THE GGG.CAFE PARTIES WON'T BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY OR PUNITIVE DAMAGES, OR FOR LOST DATA, PROFITS OR OPPORTUNITIES, ARISING FROM OR RELATED TO THE SERVICE, EVEN IF WE WERE TOLD THEY WERE POSSIBLE.",
      "TO THE FULLEST EXTENT THE LAW ALLOWS, THE TOTAL LIABILITY OF THE GGG.CAFE PARTIES FOR ALL CLAIMS RELATED TO THE SERVICE IS LIMITED TO THE GREATER OF $100 OR THE AMOUNT YOU PAID US FOR THE SERVICE IN THE 12 MONTHS BEFORE THE CLAIM.",
      "Some places don't allow some of these limits. Where that's the case, they apply as far as the law allows.",
    ],
  },
  {
    id: "indemnity",
    title: "Indemnity",
    blocks: [
      "You agree to defend, indemnify and hold harmless the GGG.Cafe Parties from any claims, losses, damages and costs (including reasonable attorneys' fees) arising from your use of the Service, your User Content, any activity you do or supervise in connection with the Service, or your breaking these Terms or the law. A parent or guardian agrees to this for their minor child as well.",
    ],
  },
  {
    id: "ending",
    title: "Ending your use",
    blocks: [
      "You can stop using the Service at any time and ask us to delete your account. We can suspend or end your access at any time. The parts of these Terms that by their nature should continue (including the assumption of risk, release, disclaimers, limits on liability, indemnity and dispute terms) keep applying after your access ends.",
    ],
  },
  {
    id: "disputes",
    title: "Disputes",
    blocks: [
      "Let's talk first: before filing any claim, contact us and give us 60 days to try to resolve it informally.",
      `These Terms are governed by the laws of the Commonwealth of ${LEGAL.state}, without regard to its conflict-of-law rules. Any lawsuit must be brought in the Court of Common Pleas of ${LEGAL.county} County, ${LEGAL.state}, or the United States District Court for the Eastern District of ${LEGAL.state}, and you and we consent to those courts' jurisdiction and venue. Either side may bring a claim that qualifies in small-claims court.`,
      "To the fullest extent the law allows, claims may be brought only individually, not as a plaintiff or class member in any class, collective or representative action.",
      "To the fullest extent the law allows, any claim related to the Service must be filed within one year after it arises, or it is permanently barred.",
    ],
  },
  {
    id: "changes-terms",
    title: "Changes to these Terms",
    blocks: [
      "We may update these Terms. The date at the top shows the current version. When we make important changes, we'll ask you to agree again the next time you use the Service; if you don't agree, stop using it.",
    ],
  },
  {
    id: "general",
    title: "General",
    blocks: [
      `These Terms and the Privacy & Security Notice are the whole agreement between you and ${LEGAL.owner} about the Service. If any part is found unenforceable (for example, a release that a state doesn't allow), that part is limited only as much as needed and the rest stays in effect. If we don't enforce a part right away, we haven't waived it. You can't transfer these Terms; we can, for example to a new operator of the Service. Headings are for convenience only.`,
    ],
  },
  {
    id: "contact",
    title: "Contact",
    blocks: [`Questions about these Terms: ${contactLine}`],
  },
];

export const PRIVACY_INTRO = [
  `This notice explains what information ${LEGAL.name} collects, how we use it, who can see it and how we protect it. ${LEGAL.name} is owned and operated by ${LEGAL.owner} ("we," "us"). This notice is part of our Terms of Service.`,
  "GGG.Cafe is used by youth athletes, so we keep information inside each team and collect only what the features need.",
];

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: "collect",
    title: "What we collect",
    blocks: [
      [
        "Account information: name, email address (or the username a parent made for a player), account type and team. Passwords are stored by our sign-in provider as secure hashes; nobody at GGG.Cafe can see them.",
        "Player information: profile details (for example birth date, positions, jersey number, bats and throws), photos, training and test results, stats, goals, check-offs, journal entries, quiz results, notes and messages.",
        "Family and medical information that parents and coaches choose to add: emergency contacts, allergies, conditions, medications, physician and insurance details, and preseason questionnaire answers.",
        "Coach, mentor and parent information: name, role, team and the content you add.",
        "Technical information: the cookies that keep you signed in, and basic logs (such as IP address, browser and time of a request) that our hosting and database providers keep for security and troubleshooting. Your Night Game or Day Game choice is saved only on your device.",
      ],
      "We don't use advertising or tracking cookies, and we don't sell personal information or share it for targeted advertising.",
    ],
  },
  {
    id: "use",
    title: "How we use it",
    blocks: [
      "Only to run the Service: to let teams organize rosters, practices and games; to show players, parents, coaches and mentors the information their role allows; to send account emails (sign-up confirmations and password resets) and emails you ask for (such as a practice plan); to keep the Service secure and fix problems; and to follow the law.",
    ],
  },
  {
    id: "access",
    title: "Who can see it",
    blocks: [
      "What you can see depends on your role and team, and the database itself checks it on every request:",
      [
        "A player sees her own information. Her approved parents see their own daughter's information.",
        "Her team's coaches see their players' information. Medical cards are limited to head coaches, admins and the player's approved parents.",
        "Teammates see each other only in limited team views, such as the leaderboard, the team yearbook and squads.",
        "An approved mentor sees what's needed to work with the players assigned to them.",
        "GGG.Cafe admins can see information to run and support the Service.",
      ],
      "Player photos and team logos are stored privately and shown only to signed-in users, through links that expire.",
      "We share information outside these roles only with the providers below, when the law requires it, to protect someone's safety, with a parent's consent, or with a new operator if the Service is transferred (who must follow this notice).",
    ],
  },
  {
    id: "providers",
    title: "Service providers",
    blocks: [
      "Supabase (database, sign-in and file storage, hosted in the United States), Vercel (website hosting) and email providers for account and practice-plan emails. They process information only to provide their services to us.",
    ],
  },
  {
    id: "children",
    title: "Children and teens",
    blocks: [
      "GGG.Cafe is built for youth athletes, with parents involved.",
      "Children under 13 can't sign themselves up. A parent or guardian creates the player's login from the family page; doing so is their consent to us collecting and using the child's information as this notice describes.",
      "Parents can review their child's information, ask us to correct or delete it, and withdraw their consent at any time by contacting us or the head coach. Deleting the information ends the child's access.",
      "If we learn we collected information from a child under 13 without a parent's consent, we'll delete it.",
    ],
  },
  {
    id: "security",
    title: "How we protect information",
    blocks: [
      [
        "Encrypted connections (HTTPS) for everything you send and receive.",
        "Information stored encrypted at rest by our database provider.",
        "Passwords hashed by our sign-in provider: nobody at GGG.Cafe can read them.",
        "Row-level security on every table: the database checks who is asking before it returns anything.",
        "Invite-only sign-up: a team code plus approval by a coach or admin.",
        "Private file storage with links that expire, for photos and team logos.",
        "Limits on password-reset emails, and other protections against abuse.",
        "Admin access only where it's needed to run the Service.",
      ],
      "No system is perfectly secure. If a breach affects your personal information, we'll notify the affected users, parents and authorities as the law requires.",
      "You help too: use a strong, unique password, don't share your login, and sign out on shared devices.",
    ],
  },
  {
    id: "retention",
    title: "Keeping and deleting information",
    blocks: [
      "We keep information while the account or team is active and as long as needed to run the Service. You can ask us to delete your account or your child's information at any time; we'll delete it except for anything the law requires us to keep. Copies in backups are removed on the backup schedule.",
      "Records of when someone agreed to the Terms are kept as long as needed to show that agreement.",
    ],
  },
  {
    id: "rights",
    title: "Your choices and rights",
    blocks: [
      "You can view and update much of your information in the Service. You can ask us for a copy, a correction or deletion. Depending on where you live, you may have other privacy rights; contact us and we'll respond as the law requires.",
    ],
  },
  {
    id: "changes",
    title: "Changes to this notice",
    blocks: [
      "We'll update this notice when our practices change. The date at the top shows the current version. Important changes are shown when you next sign in.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    blocks: [`Privacy questions and requests: ${contactLine}`],
  },
];

/** The site-wide footer disclaimer (every page). */
export const FOOTER_DISCLAIMER =
  "Drills, workouts and training routines on GGG.Cafe, including ones added by users, are general information, not medical advice. Use them at your own risk: check with a doctor before starting a program and train with qualified supervision. Points, badges and awards are for fun only and have no cash value.";

/** The agreement people check at sign-up and on /terms/accept. */
export const AGREEMENT_LABEL =
  "I've read and agree to the Terms of Service and the Privacy & Security Notice, including the assumption of risk for drills and workouts. If I'm under 18, my parent or guardian has read and agreed to them too.";

/** The short version shown on /terms/accept above the checkbox. */
export const TERMS_SUMMARY = [
  "Drills, workouts and routines on GGG.Cafe are used at your own risk. They're general information, not medical advice.",
  "Points, badges and awards are for fun. They have no cash value.",
  "We protect your information and keep it inside your team, but no system is perfectly secure.",
  "If you're under 18, your parent or guardian agrees to these Terms for you.",
];

/** Pages anyone can open without agreeing first: signed-out pages, sign-in help and the documents. */
const OPEN_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/auth", "/terms", "/privacy", "/manifest.webmanifest"];

/**
 * True when a signed-in request should go to /terms/accept first: a page load (GET) by someone who
 * hasn't agreed to the current version, outside the open pages. Form posts pass, so nothing is lost
 * mid-save; the next page load asks.
 */
export function needsTermsAgreement(path: string, method: string, agreedVersion: unknown): boolean {
  if (method !== "GET" && method !== "HEAD") return false;
  if (agreedVersion === TERMS_VERSION) return false;
  if (path === "/") return false;
  return !OPEN_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Where to go after agreeing: a path on this site, else the dashboard. */
export function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/dashboard";
}
