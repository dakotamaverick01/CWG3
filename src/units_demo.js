'use strict';
// Demo order of battle for Millbrook (fictional officers; generic regiment names). Regiments expand to battalions:
// 500+ men → two wings; bns:3 for regulars/cavalry. face: 0=E 1=SE 2=SW 3=W 4=NW 5=NE
window.OOB_DEMO = {
 CS: {
  singles: [
   { type: 'hq', name: '1st Corps HQ', ldr: 'Maj. Gen. E. Carrow', form: 'est', c: 24, r: 10, men: 60, wpn: 'Pistols & sabres', st: 8 },
   { type: 'art', name: 'Rockbridge Battery', ldr: 'Capt. M. Avery', form: 'lim', c: 25, r: 13, men: 80, guns: 4, wpn: '10-pdr Parrott RF' } ],
  divisions: [ { id: 'csd1', name: "Tuckett's Division", ldr: 'Brig. Gen. L. Tuckett', st: 6, c: 21, r: 10 },
               { id: 'csd2', name: "Rourke's Division", ldr: 'Brig. Gen. H. Rourke', st: 7, c: 24, r: 5 } ],
  brigades: [
   { id: 'cs1', div: 'csd1', name: "Whitlock's Brigade", ldr: 'Col. A. Whitlock', st: 6, c: 19, r: 7, face: 3, form: 'combat',
     regs: [{ name: '22nd Virginia', men: 420 }, { name: '8th Georgia', men: 520 }, { name: '14th Alabama', men: 380 }, { name: '3rd Arkansas', men: 350 }],
     attached: [{ type: 'art', name: 'Belmont Battery', ldr: 'Capt. R. Belmont', form: 'unl', c: 20, r: 8, men: 90, guns: 4, wpn: '12-pdr Napoleon SB' },
                { type: 'spec', name: "Crane's Sharpshooters", ldr: 'Maj. H. Crane', form: 'one', c: 18, r: 8, men: 200, wpn: 'Whitworth Target RF', st: 7 }] },
   { id: 'cs2', div: 'csd1', name: "Pryor's Brigade", ldr: 'Col. J. Pryor', st: 5, c: 19, r: 12, face: 3, form: 'combat',
     regs: [{ name: '11th North Carolina', men: 610 }, { name: '26th Georgia', men: 400 }, { name: '2nd Mississippi', men: 360 }, { name: '17th Tennessee', men: 330 }] },
   { id: 'cs3', div: 'csd2', name: "Harlan's Brigade", ldr: 'Col. T. Harlan', st: 7, c: 23, r: 4, face: 2, form: 'march',
     regs: [{ name: '6th Louisiana', men: 380 }, { name: '9th Texas', men: 340 }, { name: '12th South Carolina', men: 450 }, { name: '1st Maryland Bn', men: 250 }] },
   { id: 'cs4', name: "Tolliver's Cavalry", ldr: 'Col. W. Tolliver', st: 7, c: 27, r: 11, face: 3, form: 'mounted',
     regs: [{ name: '3rd Virginia Cav.', men: 540, bns: 3, type: 'cav', wpn: 'Sharps Carbine' }] } ] },
 US: {
  singles: [
   { type: 'hq', name: 'II Corps HQ', ldr: 'Maj. Gen. O. Pell', form: 'mounted', c: 1, r: 9, men: 60, wpn: 'Pistols & sabres', st: 7 },
   { type: 'art', name: 'Battery C, 2nd U.S.', ldr: 'Capt. L. Marsh', form: 'lim', c: 4, r: 10, men: 120, guns: 6, wpn: '3-in Ordnance RF' },
   { type: 'eng', name: '1st Engineer Bn', ldr: 'Maj. C. Lund', form: 'march', c: 5, r: 12, men: 300, wpn: 'Springfield RF' },
   { type: 'scout', name: 'Scouts', ldr: 'Capt. B. Hale', form: 'one', c: 12, r: 18, men: 60, wpn: 'Spencer Carbine' } ],
  divisions: [ { id: 'usd1', name: "Whitcomb's Division", ldr: 'Brig. Gen. T. Whitcomb', st: 5, c: 8, r: 9 },
               { id: 'usd2', name: "Dorrance's Division", ldr: 'Brig. Gen. E. Dorrance', st: 6, c: 5, r: 11 } ],
  brigades: [
   { id: 'us1', div: 'usd1', name: "Ashford's Brigade", ldr: 'Col. N. Ashford', st: 5, c: 10, r: 10, face: 0, form: 'march',
     regs: [{ name: '5th New York', men: 450 }, { name: '20th Massachusetts', men: 520 }, { name: '7th Wisconsin', men: 380 }, { name: '19th Indiana', men: 360 }] },
   { id: 'us2', div: 'usd1', name: "Keene's Brigade", ldr: 'Col. P. Keene', st: 5, c: 11, r: 8, face: 0, form: 'combat',
     regs: [{ name: '3rd Pennsylvania', men: 400 }, { name: '12th Massachusetts', men: 350 }, { name: '88th Pennsylvania', men: 420 }, { name: '2nd Delaware', men: 300 }] },
   { id: 'us3', div: 'usd2', name: "Rowe's Brigade", ldr: 'Col. D. Rowe', st: 6, c: 10, r: 14, face: 0, form: 'combat',
     regs: [{ name: '14th U.S. (Regulars)', men: 900, bns: 3, q: 75 }, { name: '4th Michigan', men: 380 }] },
   { id: 'us4', div: 'usd2', name: "Voss's Brigade", ldr: 'Col. K. Voss', st: 5, c: 3, r: 7, face: 0, form: 'march',
     regs: [{ name: '11th Pennsylvania', men: 420 }, { name: '6th Ohio', men: 380 }, { name: '1st Minnesota', men: 460 }, { name: '13th New Jersey', men: 330 }] },
   { id: 'us5', name: "Brandt's Cavalry", ldr: 'Col. F. Brandt', st: 5, c: 3, r: 16, face: 0, form: 'mounted',
     regs: [{ name: '1st Michigan Cav.', men: 480, bns: 3, type: 'cav', wpn: 'Burnside Carbine' }] } ] } };
// Reinforcement brigades: arrive around (c,r) at time `at` (minutes from midnight, Day 1)
window.REINF_DEMO = [
 { at: 600, side: 'US', c: 0, r: 10, brigade: { id: 'us6', div: 'usd2', name: "Maddox's Brigade", ldr: 'Col. G. Maddox', st: 5, face: 0, form: 'march',
   regs: [{ name: '2nd Vermont', men: 480 }, { name: '9th Maine', men: 410 }, { name: '16th Connecticut', men: 540 }, { name: '4th Rhode Island', men: 320 }] } },
 { at: 660, side: 'CS', c: 31, r: 10, brigade: { id: 'cs5', div: 'csd2', name: "Lomax's Brigade", ldr: 'Col. R. Lomax', st: 6, face: 3, form: 'march',
   regs: [{ name: '5th Florida', men: 360 }, { name: '19th Virginia', men: 430 }, { name: '7th North Carolina', men: 390 }] } },
];
