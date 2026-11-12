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
export const TERMS_VERSION = "2026-11-12";

/** Shown at the top of both documents. */
export const EFFECTIVE_DATE = "November 12, 2026";

/** Who runs GGG.Cafe, whose law applies, and where to reach us (user, 2026-11-09). */
export const LEGAL = {
  /** how the documents name the service */
  name: "GGG.Cafe",
  /** the company that owns and operates it: the party to the Terms and the copyright holder */
  owner: "GMI Digital LLC",
  /** the state whose law governs the Terms, and the county where a court case would be filed */
  state: "Pennsylvania",
  county: "Northampton",
  /**
   * Where people send legal and privacy questions, requests to see or delete information, copyright
   * notices and arbitration opt-outs. Email only for now (user, 2026-11-11): a mailing address and
   * phone number still need to be added for the children's privacy notice and copyright notices.
   */
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
  /** set in bold so it stands out (release, warranty disclaimer, limits of liability, arbitration) */
  conspicuous?: boolean;
};

const contactLine = `Email ${LEGAL.contact}, or ask your team's head coach to pass your message to a GGG.Cafe admin.`;

/** The boxed notice at the top of the Terms: the arbitration agreement has to be impossible to miss. */
export const TERMS_NOTICE =
  "IMPORTANT: SECTION 20 REQUIRES YOU AND US TO RESOLVE ALMOST ALL DISPUTES THROUGH BINDING, INDIVIDUAL ARBITRATION INSTEAD OF IN COURT, AND IT WAIVES CLASS ACTIONS AND JURY TRIALS. YOU CAN OPT OUT OF ARBITRATION WITHIN 30 DAYS BY FOLLOWING SECTION 20.";

export const TERMS_INTRO = [
  `These Terms of Service ("Terms") are a binding agreement between you and ${LEGAL.owner}, which owns and operates ${LEGAL.name} ("${LEGAL.name}," "we," "us," "our"). They cover the ${LEGAL.name} website, the app you can add to your phone's home screen, and every feature, page, email and piece of content we provide through them (together, the "Service").`,
  "Please read them carefully. They include an assumption of risk and a release of claims (section 4), a disclaimer of warranties (section 16), limits on our liability (section 17), an indemnity (section 18), and a binding arbitration agreement with a waiver of class actions and jury trials (section 20).",
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: "agreeing",
    title: "Agreeing to these Terms",
    blocks: [
      "You accept these Terms when you create an account, check the box agreeing to them, or use the Service. Checking the box is your electronic signature and has the same effect as signing on paper. If you don't agree, don't use the Service.",
      "If you're under 18, your parent or legal guardian must read and agree to these Terms for you. A parent or guardian who lets a minor use the Service agrees to these Terms on the minor's behalf and on their own, and is responsible for the minor's use, including the assumption of risk, the release, the indemnity and the arbitration agreement below.",
      "Children under 13 can't create their own account. Their parent or guardian first gives verified consent (a signed consent form or a short video call, checked by our staff), then makes the player's login from the family page, as our Privacy & Security Notice describes.",
      "If you use the Service for a team, club, school or other organization, you confirm that you're allowed to accept these Terms for it, and these Terms bind both you and the organization. Either way, you're personally bound.",
      "You can't use the Service if the law doesn't allow you to, or if we've removed you from it before.",
    ],
  },
  {
    id: "service",
    title: "What GGG.Cafe is, and what it isn't",
    blocks: [
      "GGG.Cafe is a softball player-development and team-management tool. Coaches use it to organize teams, practices and games; players use it to track their training, goals and progress; parents and mentors use it to support them.",
      "GGG.Cafe is an online tool. It is not a coach, trainer, doctor, league, club or governing body. We don't run or supervise any practice, game, workout, lesson or training session, and the coaches, mentors and other people who use the Service aren't our employees or agents.",
      "We don't screen users. When a coach or admin approves an account, that only lets the person use the Service. It is not a background check, certification or endorsement. Parents decide whether their child uses the Service and who their child works with. Anything between users, on or off the Service, is between those users.",
      "We don't promise any result from using the Service: not improvement, a roster spot, playing time, a win, a scholarship, recruiting interest or a college roster. Stats, rankings, ratings and other information on the Service can be incomplete or wrong (much of it is entered by users), and we don't have to update or correct it.",
    ],
  },
  {
    id: "account",
    title: "Your account",
    blocks: [
      "Give accurate information and keep it current. Use one account per person and don't sell, lend or share it. Keep your password private: you're responsible for everything done with your account. Tell your coach or us right away if you think someone else has used it.",
      "A parent who makes a player login for their child is responsible for that login and how it's used.",
      "Team codes are for the people a coach invites. Don't post or share them publicly. Coaches are responsible for who they invite and approve.",
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
      `Release: to the fullest extent the law allows, you (and, for a minor, the parent or guardian, on the minor's behalf and on their own) release, waive and agree not to sue ${LEGAL.owner}, ${LEGAL.name}, and their members, managers, owners, employees, contractors, agents, administrators, volunteers, contributors, successors and assigns (the "GGG.Cafe Parties") over any injury, illness, death, loss or damage connected to Training Content or any activity connected to the Service, including claims based on the negligence of the GGG.Cafe Parties. This release does not cover gross negligence, recklessness, intentional misconduct, or anything else the law doesn't allow to be released.`,
      "If the law doesn't let a parent or guardian release a minor's own claims, the parent or guardian still releases their own claims (for example, for medical expenses) to the same extent, and the indemnity in section 18 still applies.",
      "Coaches and the organizations that run practices and training are responsible for supervising them, for checking that each drill and workout suits their players' age, health and ability, and for following their league's safety rules.",
    ],
  },
  {
    id: "advice",
    title: "Not medical, mental-health or professional advice",
    blocks: [
      "Nothing on the Service is medical, psychological, nutritional or other professional advice, diagnosis or treatment. That includes training, recovery, nutrition, mental-game tools, guided sessions, journals and movement or hitting-style profiles. Ask a qualified professional about your health.",
      "Mental-game tools are for focus and confidence in sport. They aren't counseling or therapy. If you or someone you know is struggling or in crisis, call or text 988 (the Suicide & Crisis Lifeline in the U.S.). If someone is in danger, call 911.",
      "Medical cards help coaches in an emergency. They don't replace calling 911 or getting medical care. Parents are responsible for keeping them complete and current, and coaches are responsible for how they use them.",
    ],
  },
  {
    id: "content",
    title: "Content you add",
    blocks: [
      'You\'re responsible for what you add: routines, drills, practice plans, notes, goals, journal entries, messages, photos, stats and anything else ("User Content"). You promise that you have the right to add it, that it doesn\'t break the law or anyone\'s rights, and that you have permission from anyone who appears in a photo or whose personal information you add (a parent\'s permission for a minor).',
      "You keep ownership of your User Content. You give GGG.Cafe a non-exclusive, royalty-free, worldwide license to host, store, back up, copy, display, adapt the format of and process it, only to run, secure and improve the Service and to show it to the people your role and team allow. This license ends when your User Content is deleted, except for backup copies until they're overwritten and content others still need, as described below.",
      "Some User Content becomes part of a team's records or someone else's account (for example box scores, stats, messages already sent and team yearbook photos). It can stay there after your account is deleted, and we can keep it in a form that doesn't identify you.",
      "We can make de-identified, combined information from use of the Service (for example, how many teams use a feature) that doesn't identify any person, and use it for any lawful purpose.",
      "We don't review User Content before it appears and we don't endorse it. We can remove, hide or refuse any content at any time, for any reason.",
      "If you send us ideas or suggestions, we can use them without owing you anything.",
    ],
  },
  {
    id: "rewards",
    title: "Points, badges and awards are for fun",
    blocks: [
      'Points, ranks, leaderboards, Player of the Week, badges, trophies, rings, Golden Gloves, MVP badges, certificates, the Leader Badge and every other award or reward on the Service ("Rewards") are for fun, motivation and illustration only.',
      "Rewards are based on what users enter, which we don't verify. They have no cash or monetary value. They can't be redeemed, sold, traded or transferred, and they aren't prizes, scholarships or official honors. They aren't an official ranking, evaluation or recruiting assessment from any team, league, school or college.",
      "We can change, recalculate, reset or remove Rewards at any time.",
    ],
  },
  {
    id: "rules",
    title: "Rules for using GGG.Cafe",
    blocks: [
      [
        "Treat everyone with respect: no bullying, harassment, threats, hate, or sexual or violent content.",
        "Adults: keep communication with players about softball and appropriate for their age, and include their parents. Never use the Service to seek private or inappropriate contact with a minor.",
        "Don't pretend to be someone else or use someone else's account.",
        "Don't share team codes, paid content, or other people's information, photos or messages beyond the people allowed to see them.",
        "Don't collect information about other users, and don't post anyone's private information without permission.",
        "Don't try to get into accounts, information or parts of the Service you aren't allowed to see, and don't test, probe or get around its security, access limits or paid features.",
        "Don't upload viruses or harmful code, and don't copy, scrape, crawl, data-mine, overload, decompile or reverse engineer the Service, or use it or its content to build or train another product or an artificial intelligence model.",
        "Don't use the Service for anything illegal, for advertising or spam, or to sell or resell access to it.",
      ],
      "We have zero tolerance for content that sexualizes or exploits a minor. We remove it, end the accounts involved, and report it to the National Center for Missing & Exploited Children and to law enforcement as the law requires.",
      "Coaches and admins can remove content and accounts that break these rules. If you see something wrong, tell a coach or contact us. We may keep and share information with the authorities when we believe that's needed to protect someone's safety or to follow the law.",
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
    title: "Our content and your license to use it",
    blocks: [
      `The Service and everything we provide on it (software, design, text, lessons, chapters, quizzes, questions, graphics, the GGG.Cafe name and logos, and the Elevate Together artwork) belong to ${LEGAL.owner} or its licensors and are protected by copyright, trademark and other laws.`,
      "While you follow these Terms, we give you a limited, personal, non-exclusive, non-transferable, revocable license to use the Service for your own and your team's softball development. We keep every right we don't expressly give you.",
      "Don't copy, share, sell, publish, frame or make other works from our content, and don't remove our notices or use our name or logos without written permission. Paid or advanced content is licensed only to the accounts it's unlocked for.",
    ],
  },
  {
    id: "fees",
    title: "Paid features, subscriptions and refunds",
    blocks: [
      "Some features (such as G3 Advanced) may require payment. Before you pay, we'll show the price, what's included, the billing period and how renewal works, or they'll be in the written offer you accept. You agree to pay the fees and any taxes, and you authorize us (and our payment processor) to charge the payment method you give us.",
      "Subscriptions renew automatically at the end of each billing period at the then-current price until you cancel. You can cancel at any time using the method shown when you subscribed or by emailing us; cancellation takes effect at the end of the current billing period, and you keep access until then. If we offer a free trial, it turns into a paid subscription at the end of the trial unless you cancel before it ends.",
      "We'll tell you at least 30 days before a price change applies to your next renewal, so you can cancel first.",
      "Fees are non-refundable, including for partial billing periods and unused features, except where the law requires a refund or we agree in writing. If we choose to give a refund once, we don't have to do it again.",
      "If you buy through an app store or another seller, its payment, renewal and refund terms apply to that purchase. If a team, club or organization pays for your access, your access depends on its arrangement with us, and refunds go to whoever paid.",
      "If a payment fails or is reversed, we can suspend paid features until it's paid.",
    ],
  },
  {
    id: "copyright",
    title: "Copyright complaints",
    blocks: [
      `We respect copyrights and expect users to do the same. If you believe content on the Service infringes your copyright, email ${LEGAL.contact} with the subject "Copyright notice" and include:`,
      [
        "your physical or electronic signature, and your name, mailing address, phone number and email;",
        "the copyrighted work you believe is infringed;",
        "where the content is on the Service, with enough detail for us to find it;",
        "a statement that you believe in good faith that the use isn't authorized by the copyright owner, its agent or the law; and",
        "a statement, under penalty of perjury, that your notice is accurate and that you are the owner or are authorized to act for the owner.",
      ],
      "If your content was removed and you believe that was a mistake, you can send a counter-notice to the same address, with your signature and contact details, a description of the removed content and where it was, a statement under penalty of perjury that you believe in good faith it was removed by mistake or misidentification, and your consent to the jurisdiction of the federal court for your address (or, outside the U.S., for the Eastern District of Pennsylvania).",
      "Knowingly false notices or counter-notices can make the sender liable for damages. We end the accounts of users who repeatedly infringe.",
    ],
  },
  {
    id: "providers",
    title: "Other services and links",
    blocks: [
      "The Service runs on outside providers for hosting, the database, sign-in, file storage, payments and email. Their services can be interrupted, and we aren't responsible for them. Links to other websites, videos and services are for convenience; we don't control or endorse them, and your use of them is governed by their own terms.",
    ],
  },
  {
    id: "communications",
    title: "Electronic communications and notices",
    blocks: [
      "You agree to receive agreements, notices, disclosures and other communications from us electronically: by email to the address on your account, or in the Service. They satisfy any legal requirement that they be in writing. Account and security messages (such as sign-up confirmations and password resets) are part of the Service and can't be turned off while your account is open; if we ever send marketing emails, each one will let you unsubscribe.",
      `Legal notices to us must be emailed to ${LEGAL.contact} with the subject "Legal notice." A notice is received when it's sent, unless the sender learns it wasn't delivered.`,
    ],
  },
  {
    id: "changes-service",
    title: "Changes and availability",
    blocks: [
      "We can change, suspend or stop any part of the Service at any time, with or without notice, and we can set limits on features or storage. We don't promise the Service will always be available, on time or free of errors, and we aren't liable for any change, suspension or stop.",
    ],
  },
  {
    id: "warranties",
    title: "Disclaimer of warranties",
    conspicuous: true,
    blocks: [
      'TO THE FULLEST EXTENT THE LAW ALLOWS, THE SERVICE, ALL TRAINING CONTENT, ALL USER CONTENT AND ALL OTHER CONTENT ARE PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, ACCURACY, SAFETY, SECURITY, QUIET ENJOYMENT AND NON-INFRINGEMENT, AND ANY WARRANTIES ARISING FROM A COURSE OF DEALING OR USAGE OF TRADE.',
      "WE DON'T WARRANT THAT ANY DRILL, WORKOUT OR OTHER CONTENT IS SAFE, ACCURATE OR RIGHT FOR YOU, THAT USING THE SERVICE WILL PRODUCE ANY RESULT, THAT INFORMATION ON IT IS COMPLETE OR CURRENT, OR THAT THE SERVICE WILL BE SECURE, UNINTERRUPTED, OR FREE OF ERRORS OR HARMFUL CODE. NO ADVICE OR INFORMATION FROM US OR ANY USER CREATES A WARRANTY NOT STATED IN THESE TERMS.",
    ],
  },
  {
    id: "liability",
    title: "Limits on our liability",
    conspicuous: true,
    blocks: [
      "TO THE FULLEST EXTENT THE LAW ALLOWS, THE GGG.CAFE PARTIES WON'T BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY OR PUNITIVE DAMAGES, OR FOR LOST DATA, PROFITS, REVENUE, GOODWILL OR OPPORTUNITIES (INCLUDING ATHLETIC, SCHOLARSHIP OR RECRUITING OPPORTUNITIES), ARISING FROM OR RELATED TO THE SERVICE, EVEN IF WE WERE TOLD THEY WERE POSSIBLE.",
      "TO THE FULLEST EXTENT THE LAW ALLOWS, THE GGG.CAFE PARTIES AREN'T LIABLE FOR THE CONDUCT OF ANY USER OR THIRD PARTY, ON OR OFF THE SERVICE; FOR USER CONTENT OR TRAINING CONTENT; FOR OUTSIDE SERVICES; OR FOR ANY UNAUTHORIZED ACCESS TO, USE OF OR CHANGE TO YOUR ACCOUNT OR INFORMATION.",
      "TO THE FULLEST EXTENT THE LAW ALLOWS, THE TOTAL LIABILITY OF THE GGG.CAFE PARTIES FOR ALL CLAIMS RELATED TO THE SERVICE IS LIMITED TO THE GREATER OF $100 OR THE AMOUNT YOU PAID US FOR THE SERVICE IN THE 12 MONTHS BEFORE THE CLAIM.",
      "These limits apply to every legal theory (contract, warranty, negligence, strict liability or any other) and even if a remedy fails of its essential purpose. They are an essential part of the bargain: the Service would not be offered without them. Some places don't allow some of these limits; where that's the case, they apply as far as the law allows.",
    ],
  },
  {
    id: "indemnity",
    title: "Indemnity",
    blocks: [
      "You agree to defend, indemnify and hold harmless the GGG.Cafe Parties from any claims, demands, losses, damages, fines and costs (including reasonable attorneys' fees) arising from your use of the Service, your User Content, any practice, game, workout, lesson or other activity you do, run or supervise in connection with the Service, your dealings with other users, or your breaking these Terms, the law or anyone's rights. A parent or guardian agrees to this for their minor child as well.",
      "We can choose to control the defense of any matter you must indemnify, and you'll cooperate with us. You won't settle any such matter without our written consent.",
    ],
  },
  {
    id: "ending",
    title: "Ending your use",
    blocks: [
      "You can stop using the Service at any time and ask us to delete your account. We can suspend or end your access at any time, with or without notice, including for breaking these Terms or for safety reasons. If we end your access for breaking these Terms, fees already paid aren't refunded.",
      "After your access ends, we can delete your account and User Content as our Privacy & Security Notice describes. The parts of these Terms that by their nature should continue (including the assumption of risk, release, content licenses, fees owed, disclaimers, limits on liability, indemnity, arbitration and dispute terms, and the general terms) keep applying.",
    ],
  },
  {
    id: "disputes",
    title: "Disputes: binding individual arbitration and class action waiver",
    conspicuous: true,
    blocks: [
      `Let's talk first. Before starting any arbitration or lawsuit, the side with a claim must send the other a written Notice of Dispute: notices to us go to ${LEGAL.contact} with the subject "Notice of Dispute," and notices to you go to the email on your account. The notice must include the sender's name and contact information, the account email (if any), a description of the claim and the relief requested, and be signed by the person with the claim (not only a lawyer). Both sides will then try in good faith, for 60 days, to resolve it, including by a phone or video call if either side asks. Deadlines to bring the claim are paused during those 60 days.`,
      'Agreement to arbitrate. If the dispute isn\'t resolved, you and GMI Digital LLC agree that any dispute, claim or controversy arising from or relating to these Terms, the Service, Training Content, any activity connected to the Service, or our relationship, whether based on contract, tort, statute or any other theory, and whether it arose before or after you agreed to these Terms (a "Dispute"), will be resolved only by final, binding arbitration on an individual basis. The Federal Arbitration Act governs this agreement to arbitrate.',
      "Exceptions. Either side may instead bring an individual claim in small-claims court if it qualifies and stays there, and either side may go to court to stop the infringement or misuse of its intellectual property or to stop unauthorized access to the Service.",
      `How it works. The American Arbitration Association ("AAA") will administer the arbitration under its Consumer Arbitration Rules, as changed by this section; its rules and fee schedules are at adr.org. One arbitrator decides. Hearings will be by video or phone, or decided on written submissions, unless the arbitrator decides an in-person hearing is needed; an in-person hearing will be held in the county where you live or in ${LEGAL.county} County, ${LEGAL.state}. The arbitrator can award the same individual damages and relief a court could, but only to the person bringing the claim and only as far as needed for that person's individual claim. The award is final and any court with jurisdiction can enter judgment on it. Fees are paid as the AAA's rules require; if you show that the fees you'd have to pay would be too costly compared with a lawsuit, we'll pay as much of them as the arbitrator decides is necessary.`,
      "Who decides. The arbitrator decides all questions about the Dispute, including whether a claim must be arbitrated, except that a court decides questions about the class action waiver, the mass-filing paragraph below, and whether a person opted out.",
      "CLASS ACTION AND JURY TRIAL WAIVER. YOU AND WE EACH AGREE TO BRING CLAIMS ONLY IN AN INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY CLASS, COLLECTIVE, CONSOLIDATED OR REPRESENTATIVE PROCEEDING. THE ARBITRATOR CAN'T COMBINE MORE THAN ONE PERSON'S CLAIMS OR PRESIDE OVER A CLASS OR REPRESENTATIVE PROCEEDING. YOU AND WE EACH GIVE UP THE RIGHT TO A JURY TRIAL.",
      "Many similar claims at once. If 25 or more Notices of Dispute or arbitration demands raising similar claims are sent by or with the help of the same or coordinated lawyers or organizations, the AAA's Mass Arbitration Supplementary Rules apply, the 60-day talk-first period applies to each claim, and the claims will be filed and decided in batches of up to 50, one batch at a time, with deadlines paused for the claims waiting their turn. A court can enforce this paragraph.",
      `Opting out. You can opt out of this agreement to arbitrate within 30 days after you first agree to these Terms (for accounts that existed before ${EFFECTIVE_DATE}, within 30 days after you agree to this version) by emailing ${LEGAL.contact} with the subject "Arbitration opt-out," your name, the email on your account and a statement that you opt out. Opting out doesn't affect anything else in these Terms, including the class action waiver as far as the law allows.`,
      "If part of this section is unenforceable. If the class action waiver is found unenforceable for a claim, that claim (and only that claim) goes to court as described in the next section, not to class arbitration. If a claim for public injunctive relief can't be waived or arbitrated under applicable law, it will be decided by a court after the individual claims are arbitrated. Otherwise, any part of this section found unenforceable is removed and the rest stays in effect.",
      "Time limit. To the fullest extent the law allows, any claim related to the Service must be brought within one year after it arises, or it is permanently barred.",
    ],
  },
  {
    id: "law",
    title: "Governing law and courts",
    blocks: [
      `These Terms are governed by the Federal Arbitration Act and the laws of the Commonwealth of ${LEGAL.state}, without regard to conflict-of-law rules. Any Dispute that isn't arbitrated (including a claim by someone who opted out of arbitration) must be brought only in the Court of Common Pleas of ${LEGAL.county} County, ${LEGAL.state}, or the United States District Court for the Eastern District of ${LEGAL.state}, and you and we consent to those courts' jurisdiction and venue. TO THE FULLEST EXTENT THE LAW ALLOWS, YOU AND WE WAIVE A JURY TRIAL IN ANY SUCH CASE.`,
    ],
  },
  {
    id: "changes-terms",
    title: "Changes to these Terms",
    blocks: [
      "We may update these Terms. The date at the top shows the current version. When we make important changes, we'll ask you to agree again the next time you use the Service; if you don't agree, stop using it. Changes don't apply to a Dispute we already had notice of before the change.",
      `If we change the arbitration section in the future, you can reject that change by emailing ${LEGAL.contact} within 30 days after the change takes effect; the arbitration section you last agreed to will then keep applying to you.`,
    ],
  },
  {
    id: "general",
    title: "General",
    blocks: [
      `These Terms and the Privacy & Security Notice are the whole agreement between you and ${LEGAL.owner} about the Service and replace any earlier agreement about it. If any part is found unenforceable (for example, a release that a state doesn't allow), that part is limited only as much as needed and the rest stays in effect. If we don't enforce a part right away, we haven't waived it; a waiver must be in writing.`,
      "You can't transfer these Terms or your account; we can, for example to a new operator of the Service or in a merger or sale. Neither side is liable for a delay or failure caused by events outside its reasonable control, such as natural disasters, outages of outside providers, cyberattacks, war, government action or labor disputes.",
      "Nothing in these Terms makes you and us partners, employees, agents or joint venturers. Other than the GGG.Cafe Parties, who can rely on the release, disclaimers and limits on liability, no one else has rights under these Terms.",
      "The Service is run from the United States and is meant for use there. If you use it from elsewhere, you're responsible for following your local laws. You can't use the Service if you're on a U.S. government list of restricted parties or in a country under U.S. embargo.",
      'Headings are for convenience only. "Including" means "including without limitation." If these Terms are translated, the English version controls.',
    ],
  },
  {
    id: "contact",
    title: "Contact",
    blocks: [`Questions about these Terms: ${contactLine}`],
  },
];

export const PRIVACY_INTRO = [
  `This notice explains what information ${LEGAL.name} collects, where it comes from, how we use it, who can see it, how long we keep it and how we protect it. ${LEGAL.name} is owned and operated by ${LEGAL.owner} ("we," "us," "our"). This notice is part of our Terms of Service and covers the ${LEGAL.name} website, the app you can add to your phone's home screen and the emails we send.`,
  "GGG.Cafe is used by youth athletes, so we keep information inside each team, collect only what the features need, and never sell it.",
];

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: "collect",
    title: "What we collect",
    blocks: [
      [
        "Account information: name, email address (or the username a parent made for a player), account type, team and the team code used to join. Passwords are stored by our sign-in provider as secure hashes; nobody at GGG.Cafe can see them.",
        "Player information: profile details (for example birth date, graduation year, positions, jersey number, bats and throws), photos, walk-up songs, training and test results, measurements, stats, goals, check-offs, journal entries (typed, or voice memos she records), mental-game entries, quiz and test results, notes and messages.",
        "Family and medical information that parents and coaches choose to add: emergency contacts, allergies, conditions, medications, physician and insurance details, and preseason questionnaire answers (such as uniform sizes).",
        "Coach, mentor and parent information: name, role, specialty, team and the content you add.",
        "Payment information, if you buy a paid feature: what you bought and when. Card details are handled by the payment processor, not stored by us.",
        "Communications: what you send us, such as support requests and privacy requests.",
        "Technical information: the cookies that keep you signed in, and basic logs (such as IP address, browser and device type, pages requested and the time) that our hosting and database providers keep for security and troubleshooting. A few display choices, such as Night Game or Day Game, are saved only on your device.",
      ],
      "We don't use advertising, analytics or tracking cookies, we don't sell personal information, and we don't share it for targeted advertising.",
    ],
  },
  {
    id: "sources",
    title: "Where it comes from",
    blocks: [
      [
        "From you, when you sign up, fill in your profile or use a feature.",
        "From others on your team: coaches enter rosters, stats, practice notes and evaluations; parents add their child's medical card and questionnaire; mentors send messages. Whoever adds information about someone else confirms they're allowed to.",
        "Automatically, from your browser or device when you use the Service (the technical information above).",
        "From our sign-in provider, when you confirm your email or reset your password.",
      ],
    ],
  },
  {
    id: "use",
    title: "How we use it",
    blocks: [
      [
        "To run the Service: rosters, practices, games, training, goals and everything else you use it for.",
        "To show players, parents, coaches and mentors the information their role allows.",
        "To send account emails (sign-up confirmations and password resets) and emails you ask for (such as a practice plan).",
        "To process payments for paid features.",
        "To keep the Service and its users safe and secure, prevent abuse and fraud, and fix problems.",
        "To make de-identified, combined information that doesn't identify anyone, to understand and improve the Service.",
        "To follow the law, enforce our Terms and protect rights and safety.",
      ],
      "We don't use personal information to train artificial intelligence models, and we don't make decisions about anyone by automated means that have legal or similarly significant effects.",
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
        "An approved mentor sees what's needed to work with the players assigned to them. Messages between mentors and players can be reviewed for safety by the adults responsible for the team and the Service.",
        "GGG.Cafe admins can see information to run, secure and support the Service.",
      ],
      "Player photos, voice memos and team logos are stored privately and shown only to signed-in users allowed to see them, through links that expire. Nothing about a player is shown publicly on the internet.",
    ],
  },
  {
    id: "sharing",
    title: "When we share it outside your team",
    blocks: [
      [
        "With service providers that run parts of the Service for us (below). They may use the information only to provide their services to us.",
        "When the law requires it, such as a valid subpoena or court order, and to report suspected child exploitation to the National Center for Missing & Exploited Children and law enforcement.",
        "To protect the safety, rights or property of anyone, including to prevent harm, fraud or abuse, and to enforce our Terms.",
        "With your consent, or a parent's consent for a child.",
        "If the Service or GMI Digital LLC is sold, merged or transferred, with the new operator, who must protect the information as this notice describes.",
      ],
      "We don't sell personal information, we don't share it for cross-context behavioral advertising, and we don't give it to third parties for their own marketing.",
    ],
  },
  {
    id: "providers",
    title: "Service providers",
    blocks: [
      [
        "Supabase: database, sign-in, file storage and account emails, hosted in the United States.",
        "Vercel: website hosting.",
        "Resend: emails you ask us to send, such as a practice plan.",
        "A payment processor, if you buy a paid feature.",
      ],
      "They process information on our behalf and under their own security programs. We'll update this list if it changes.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies, Do Not Track and Global Privacy Control",
    blocks: [
      "We use only the cookies needed to keep you signed in and secure, and your device's own storage for display choices. We don't use advertising or analytics cookies, pixels or similar tracking tools, and we don't let other companies track you on the Service.",
      "Because we don't track you across websites or sell or share information for advertising, there's nothing for a Do Not Track or Global Privacy Control signal to turn off. We still treat a Global Privacy Control signal as a request to opt out of any sale or sharing.",
    ],
  },
  {
    id: "children",
    title: "Children's privacy (under 13)",
    blocks: [
      "GGG.Cafe is built for youth athletes, with parents involved. This section is our notice to parents under the Children's Online Privacy Protection Act (COPPA).",
      "Children under 13 can't sign themselves up. Before a child under 13 can sign in, a parent or guardian (approved for that player by the team's head coach) gives verified consent in one of two ways: by signing our consent form by hand and uploading a photo or scan of it, or by a short video call with our staff. Our staff check the consent before the parent can create the child's login, and no coach can approve a profile claim for a child under 13 until it's checked. We keep the signed form, or a note of the call, as the record of consent while we keep the child's information, and afterward only as long as needed to show that consent was given. Coaches may also add a child's profile and stats to a team roster.",
      "What we collect from or about a child: the profile, training, goals, mental-game, journal (including voice memos she records), quiz, stats, photo and message information listed above, and the medical card and questionnaire a parent adds. We use it only to provide the Service to the child and their team. We don't show it publicly, we don't use it for advertising, and we don't share it with third parties except our service providers and as the law requires. We don't ask a child for more information than a feature needs, and a child doesn't have to give more than that to take part.",
      "Parents can review their child's information, have it corrected or deleted, and refuse to let us collect or use any more of it, at any time, by contacting us or the head coach. A parent can also withdraw consent on the family page: that deletes the child's login right away, so she can't sign in. Deleting the information ends the child's access. We'll confirm a parent's identity and connection to the child before acting on a request.",
      "If we learn we collected information from a child under 13 without a parent's consent, we'll delete it.",
    ],
  },
  {
    id: "retention",
    title: "How long we keep information",
    blocks: [
      [
        "Account and player information: while the account or the team uses it. Each year we review accounts; information for a player who isn't on any active team and whose account hasn't been used for 24 months is deleted or de-identified.",
        "Children's information: only as long as needed to provide the Service to the child's team (as above), and deleted within 30 days after a parent asks.",
        "Team records, such as rosters, box scores and stats: while the team uses the Service, in a form that no longer identifies a player once her information is deleted.",
        "Medical cards: until the parent removes them, or when the player's information is deleted as above.",
        "Technical logs: as long as our providers keep them, generally no more than a few weeks.",
        "Records of when someone agreed to the Terms, and records the law requires: as long as needed to show that agreement or to follow the law.",
      ],
      "When you ask us to delete an account, we delete it within 30 days, except for information the law requires us to keep. Copies in backups are overwritten on a rolling schedule, generally within 30 days.",
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
        "Private file storage with links that expire, for photos, voice memos and team logos.",
        "Limits on password-reset emails, and other protections against abuse.",
        "Admin access only where it's needed to run the Service.",
      ],
      "GGG.Cafe isn't a healthcare provider, and medical cards aren't health records covered by HIPAA. We protect them anyway: only head coaches, admins and the player's approved parents can see them.",
      "No system is perfectly secure. If a breach affects your personal information, we'll notify the affected users, parents and authorities as the law requires, including Pennsylvania's breach notification law.",
      "You help too: use a strong, unique password, don't share your login, and sign out on shared devices.",
    ],
  },
  {
    id: "rights",
    title: "Your choices and rights",
    blocks: [
      "You can view and update much of your information in the Service. Anyone, wherever they live, can ask us to:",
      [
        "tell them what personal information we have about them and give them a copy;",
        "correct information that's wrong;",
        "delete their information or account; and",
        "stop any processing they consented to.",
      ],
      `Send requests to ${LEGAL.contact}. We'll confirm your identity (and, for a parent or an authorized agent, your authority) before acting, and we'll respond within 45 days, or tell you if we need more time as the law allows. If we turn down a request, you can appeal by replying to our answer; we'll respond to an appeal within 60 days, and if you're still not satisfied you can contact your state attorney general. We won't treat you differently for using these rights.`,
      "Depending on where you live, state law may give you more rights. California residents: we don't share personal information with third parties for their direct marketing, and we don't sell or share it. Residents of other states with privacy laws: the same rights above apply to you.",
    ],
  },
  {
    id: "international",
    title: "Where information is stored",
    blocks: [
      "The Service is run from the United States and is meant for use there. Information is stored and processed in the United States. If you use the Service from another country, your information is transferred to and processed in the United States, where privacy laws may differ from yours.",
    ],
  },
  {
    id: "links",
    title: "Other websites",
    blocks: [
      "Links to other websites, videos and services (such as a drill video) take you outside GGG.Cafe. Their own privacy policies apply, not this notice.",
    ],
  },
  {
    id: "changes",
    title: "Changes to this notice",
    blocks: [
      "We'll update this notice when our practices change. The date at the top shows the current version. Important changes are shown when you next sign in, and you'll be asked to agree again. Before we use a child's information in a materially different way, we'll get a parent's consent.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    blocks: [`Privacy questions and requests: ${contactLine}`],
  },
];

/**
 * Verified parental consent for players under 13 (COPPA; docs/features/legal.md). The family page and the
 * printable form (src/lib/pdf/consent-form-pdf.tsx) use these words; the form's version is TERMS_VERSION.
 */
export const PRIVACY_URL = "https://gggcafe.vercel.app/privacy";
export const CONSENT_FORM_TITLE = "Parental Consent for a Player Under 13";
export const CONSENT_NOTICE: { heading: string; text: string }[] = [
  {
    heading: "Why we're asking",
    text: `${LEGAL.name} is run by ${LEGAL.owner}. A federal law, the Children's Online Privacy Protection Act (COPPA), requires a parent's verified consent before we collect personal information from a child under 13. Until we've checked your consent, we won't collect information from her and she can't sign in.`,
  },
  {
    heading: "What she adds when she signs in",
    text: "Her goals, training check-offs and workouts, journal and mental-game entries (her journal can include voice memos she records), quiz and test answers, messages with her coaches and the mentors you approve, and a profile photo if one is added. Her coaches also add her roster details, stats and evaluations.",
  },
  {
    heading: "How it's used and who sees it",
    text: "Only to run GGG.Cafe for her and her team. She sees her own information; so do you, her other approved parents, her team's coaches, mentors you approve and GGG.Cafe admins. Teammates see her only in team views such as the leaderboard and yearbook. Nothing is public, sold, used for advertising or used to train AI. Our hosting providers (Supabase, Vercel and Resend) process it only for us.",
  },
  {
    heading: "Your rights",
    text: `At any time you can review her information, have it corrected or deleted, and refuse to let us collect any more. Withdraw your consent on the family page (it deletes her login right away) or email ${LEGAL.contact}.`,
  },
  {
    heading: "How we check it",
    text: "Sign this form by hand and upload a photo or scan of it on your family page, or ask for a short video call with our staff instead. We compare it with your parent account before her login can be made, and keep the signed form (or a note of the call) as the record of your consent.",
  },
  {
    heading: "Full details",
    text: `Our Privacy & Security Notice, section 8, "Children's privacy (under 13)": ${PRIVACY_URL}`,
  },
];
export const CONSENT_STATEMENT = `I am the parent or legal guardian of the player named on this form. I have read this notice and the ${LEGAL.name} Privacy & Security Notice. I consent to ${LEGAL.owner} collecting, using and storing my daughter's personal information through ${LEGAL.name} as described, including what she enters herself. I understand that I can review it, have it deleted, or withdraw this consent at any time.`;

/** The site-wide footer disclaimer (every page). */
export const FOOTER_DISCLAIMER =
  "Drills, workouts and training routines on GGG.Cafe, including ones added by users, are general information, not medical advice. Use them at your own risk: check with a doctor before starting a program and train with qualified supervision. Points, badges and awards are for fun only and have no cash value.";

/** The agreement people check at sign-up and on /terms/accept. */
export const AGREEMENT_LABEL =
  "I've read and agree to the Terms of Service and the Privacy & Security Notice, including the assumption of risk for drills and workouts and the binding individual arbitration agreement and class action waiver. If I'm under 18, my parent or guardian has read and agreed to them too.";

/** The short version shown on /terms/accept above the checkbox. */
export const TERMS_SUMMARY = [
  "Drills, workouts and routines on GGG.Cafe are used at your own risk. They're general information, not medical advice.",
  "Points, badges and awards are for fun. They have no cash value.",
  "We protect your information and keep it inside your team, but no system is perfectly secure.",
  "If you're under 18, your parent or guardian agrees to these Terms for you.",
  "Disputes go to binding individual arbitration, not court, class actions or jury trials. You can opt out within 30 days (section 20).",
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
