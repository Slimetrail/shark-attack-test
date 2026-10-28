// Shark Attack v1 — side-view 2D ocean. Original art & code. 2D canvas, light on CPU.
"use strict";
// ======================= EASY-TO-CHANGE SETTINGS =======================
// ROUND_SECONDS: round length. 60 s is the DEFAULT and is NOT YET CONFIRMED by Jeremy. Test override: ?round=N
const ROUND_SECONDS=(()=>{const m=/[?&]round=(\d+(\.\d+)?)/.exec(location.search);return m?+m[1]:60})();
const N_SURF=3,MAX_LEVEL=10,MAX_PARTS=30,BEST_KEY="saTEST_best",SND_KEY="saTEST_sound",CALM_KEY="saTEST_calm",TYPE_KEY="saTEST_type",HINT_KEY="saTEST_hinted";
// Fish tiers: small / medium / big / giant. Fish bigger than the shark are dangerous (red + "!").
const TIERS=[{s:16,pts:1,grow:1,col:"#ffd23f",n:8},{s:28,pts:2,grow:2,col:"#7be04a",n:3},{s:44,pts:3,grow:3,col:"#b06cff",n:1},{s:62,pts:5,grow:4,col:"#ff7a1e",n:1}];
const N_FISH=TIERS.reduce((a,t)=>a+t.n,0);
// Steering: the finger's SLIDE direction = swim direction. Each px slid adds "drive" (speed); drive fades when the finger rests.
const STEER={MIN:.2,DRIVE_PX:.55,DRIVE_DECAY:.5,TURN:6,ACC:1.8,DEC:1.2};// DRIVE_PX: screen widths of sliding for full drive
// Launch: heading up through the surface. power = LAUNCH.K * (speed/max) * (run-up distance at speed / screen height), capped at 1.
const LAUNCH={K:2.2,MIN_POWER:.22,MIN_SPEED:.45,UP:-.35,H_MAX:.32,G:1.6,COOL:.3};// H_MAX: max height as fraction of screen height, G: gravity in screen-heights/s^2
const SURFERS=[{kind:"kneel",pts:3,hy:16},{kind:"stand",pts:5,hy:46}];// hy: how high above the water the surfer's catch point is
const BEAT={PLACEHOLDER_BPM:100,CHIPTUNE_BPM:80/*eighth-note pulse of the v2 render (music team: TEMPO_EIGHTH_BPM=80)*/,ASSIST_MS:80,PERFECT_MS:45,PERFECT_BONUS:1,on:true};
const SAFE_SPAWN_S=1.5;
// ---- v6: LANDSCAPE WORLD + DEPTH ----
// WORLD.SCREENS: world height in screen heights (camera follows the shark up/down). SKY: sky band above the surface (screen heights).
// FLOOR: volcanic floor thickness (screen heights) at the very bottom.
const WORLD={SCREENS:5,SKY:.3,FLOOR:.5,CAM_EASE:6};
// Depth zones (0 = surface, 1 = volcanic floor). Shown on the depth meter.
const ZONES=[{d:0,name:"Sunlit",col:"#3fc4f0"},{d:.3,name:"Twilight",col:"#1a5f9a"},{d:.62,name:"Midnight",col:"#0d1f45"},{d:.86,name:"Volcanic",col:"#ff6a1e"}];
// GROWTH (slowed a lot in v6): growth needed for the next size = NEED_BASE + NEED_PER_LVL × size; a creature gives size/GROW_DIV growth; a surfer gives SURFER.
// v8 growth: the shark starts as a minnow (START x full size) and gets STEP x bigger per level. Surfers need level SURF_LVL.
// The shark is DRAWN the same size all game; instead the world shrinks around it (worldK = 1/true size), eased so nothing pops.
const GROW={NEED_BASE:5,NEED_PER_LVL:2,REL:3,SURFER:2,START:.4,STEP:1.175,SURF_LVL:6,EASE:3};
const trueGrow=l=>GROW.START*Math.pow(GROW.STEP,l);
// SEA CREATURES (fish + sharks), judged against YOUR current size: smaller ones flee, bigger ones chase.
// N: creatures alive near you. SIZE_*: creature size (px "bite size") range shallow -> deep. SHARK_P_*: chance a creature is a shark, shallow -> deep.
// FOOD_SHARE: share of spawns forced smaller than you (so there is always food). SENSE: notice range (screen heights).
// FLEE: fleeing speed and CHASE_*: chasing speed, both × YOUR current top speed (chasers are always slower than your top speed).
// GIVEUP_S: a chaser gives up after this long, then rests REST_S. GLOW_DEPTH: below this depth, glowing fish + big sharks.
const CREATURES={N:22,SIZE_MIN:6,SIZE_SHALLOW:34,SIZE_DEEP:95,SHARK_P_SHALLOW:.04,SHARK_P_DEEP:.45,FOOD_SHARE:.55,SENSE:.55,FLEE:.5,CHASE_SHALLOW:.6,CHASE_DEEP:.7,GIVEUP_S:3.5,REST_S:3,GLOW_DEPTH:.8,DIVER_BAND:1.1,CHASE_MIN_D:.3,MAX_BIG:3,SPREAD_PX:110,GLOW_MAX:.84,REF_BITE:34};
// DIVERS + AMBUSH. The 3-hit lose rule and the ambush odds/timing are OUR choice, to confirm with Jeremy.
// GAME MODES. "timed" = 60 s round, 3 net hits = Caught!. "endless" = no timer, ends only when eaten (Gulp!);
// net hits only stun + cost growth there (OUR reading of Jeremy's "does not end until you are eaten").
const MODES=["timed","endless"],MODE_KEY="saTEST_mode";
// DIVER SPEED-UP (both modes): speed = shark top speed × DIVER_SPEED_FRACTION × (1 + DIVER_SPEEDUP_PER_SURFER × surfers past the trigger),
// capped at DIVER_SPEED_CAP × shark top speed. "Divers are faster!" hint every DIVER_SPEEDUP_HINT_EVERY extra surfers.
const DIVER_SPEEDUP_PER_SURFER=.05,DIVER_SPEED_CAP=1.05,DIVER_SPEEDUP_HINT_EVERY=3;
const DIVER_TRIGGER_SURFERS=3,DIVER_SPEED_FRACTION=.5,DIVER_DETECT_RANGE=.28,DIVER_GIVEUP_MS=3000,DIVER_GRACE_MS=2000,DIVER_COOLDOWN_MS=4000,DIVER_SAFE_AFTER_STUN_MS=1500,DIVER_CATCHES_TO_LOSE=3,DIVER_MAX=3,DIVER_SIZE=46,DIVER_NET_REACH=.25,DIVER_GROWTH_LOSS=2;
const STUN_MS=1000,AMBUSH_STUN_MS=2000;// a hit that brings an ambush stuns longer so the threat is real (it arrives at AMBUSH_ARRIVE_MS)
const AMBUSH_ON_HIT=[false,false,null,true],AMBUSH_CHANCE=.5;// index = net hit number; null = roll AMBUSH_CHANCE. Hit 3 also ends the round ("Caught!") so it never actually ambushes
const AMBUSH_ARRIVE_MS=1350,AMBUSH_COOLDOWN_MS=6000,STRUGGLE_SHORTEN_MS=250,STRUGGLE_PX=.2,AMBUSHER_SIZE=1.6,AMBUSHER_LEAVE_MS=3000;// STRUGGLE_PX: short-side screen lengths of drag/wiggle per shorten step
const AMB_T={body:"#3a4552",hi:"#5f6d7b",belly:"#c4ccd2",ext:"#141b22",stripe:null,hammer:false};// dark bull-style, unlike the 3 pick types
const DIVER_TIP_KEY="saTEST_diverTip";
// Shark types — they differ in size and play (decided with Jeremy: numbers are OUR choice, tune them here).
// size: start-size multiplier (fish danger is always judged against the shark's CURRENT size), speed: top speed, acc: acceleration,
// turn: turning rate, catchR: air catch radius for surfers, leap: launch height, grow: growth-meter fill rate. bars: pick-screen stat bars 1..5.
const TYPES_MECHANICAL=!/[?&]flat/.test(location.search);// true = types play differently (decided). ?flat (tests) makes all three identical, looks only
const TYPES={
 white:{name:"Great White",desc:"Biggest and fastest, but turns wide and speeds up slowly.",body:"#5d6e7e",hi:"#93a3b0",belly:"#eceff1",ext:"#26323d",stripe:null,hammer:false,
  size:1.2,speed:1.12,acc:.8,turn:.8,catchR:1.0,leap:1.0,grow:1.0,bars:{Size:5,Speed:5,Jump:3}},
 hammer:{name:"Hammerhead",desc:"Turns the tightest and grabs surfers best. Jumps a bit lower.",body:"#6a7a74",hi:"#a2afa9",belly:"#e9ece8",ext:"#2e3a35",stripe:null,hammer:true,
  size:1.0,speed:1.0,acc:1.0,turn:1.3,catchR:1.35,leap:.9,grow:1.0,bars:{Size:3,Speed:3,Jump:2}},
 tiger:{name:"Tiger Shark",desc:"Smallest, but quick off the mark, jumps highest and grows fast.",body:"#7a7660",hi:"#b0a988",belly:"#efe9d8",ext:"#3a3626",stripe:"#2c281b",hammer:false,
  size:.9,speed:1.0,acc:1.3,turn:1.05,catchR:1.0,leap:1.2,grow:1.5,bars:{Size:2,Speed:3,Jump:5}}};
// =======================================================================
const SHOW_FPS=/[?&]fps/.test(location.search);
const C=document.getElementById("c"),X=C.getContext("2d",{alpha:false});
const $=id=>document.getElementById(id);
let W=0,H=0,DPR=1,state="tap",roundLen=ROUND_SECONDS,SURF=150,BED=800;
let sType=TYPES[localStorage.getItem(TYPE_KEY)]?localStorage.getItem(TYPE_KEY):"white";
const trait=k=>TYPES_MECHANICAL?TYPES[sType][k]:1;
const P={ink:"#082a3d",foam:"rgba(220,248,255,.45)",red:"#e2463c",yel:"#ffcc33"};
function mk(w,h){const c=document.createElement("canvas");c.width=Math.max(1,Math.ceil(w));c.height=Math.max(1,Math.ceil(h));return c}

// ---------- art ----------
// v8 shaded art helpers: mix a #rrggbb colour toward black (k<0) or white (k>0)
function tone(hex,k){const n=parseInt(hex.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;const t=k<0?0:255,a=Math.abs(k);r=Math.round(r+(t-r)*a);g=Math.round(g+(t-g)*a);b=Math.round(b+(t-b)*a);return `rgb(${r},${g},${b})`}
// shaded fish, side view facing right, centred at 0,0, length ~1.6s. tier 0 slim minnow, 1 perch, 2 striped snapper, 3 heavy grouper. No cartoon outline.
function drawFish(g,s,col,tier,danger){g.lineJoin="round";const bh=s*[.24,.3,.33,.38][tier],nose=s*.62,tail=-s*.5;
 const body=()=>{g.beginPath();g.moveTo(nose,s*.02);g.bezierCurveTo(nose*.8,-bh*1.05,-s*.1,-bh*1.1,tail,-bh*.18);g.lineTo(tail,bh*.18);g.bezierCurveTo(-s*.1,bh*1.05,nose*.8,bh*.95,nose,s*.02);g.closePath()};
 const fin=(pts,c0)=>{g.beginPath();g.moveTo(pts[0]*s,pts[1]*s);for(let i=2;i<pts.length;i+=4)g.quadraticCurveTo(pts[i]*s,pts[i+1]*s,pts[i+2]*s,pts[i+3]*s);g.closePath();g.fillStyle=c0;g.fill()};
 const dark=tone(col,-.45),fc=tone(col,-.25);
 fin([tail+s*.04,0,tail-s*.12,-bh*.6/s,tail-s*.3/1,-bh*1.25/s,tail-s*.18,0,tail-s*.3,bh*1.25/s,tail-s*.12,bh*.6/s,tail+s*.04,0].map((v,i)=>i%2?v:v/s),fc);
 fin([s*.12,-bh*.9/s,s*.0,-bh*1.7/s,-s*.18/1,-bh*1.25/s,-s*.25,-bh*.85/s,-s*.25,-bh*.85/s].map((v,i)=>i%2?v:v/s),fc);
 body();const gr=g.createLinearGradient(0,-bh,0,bh);gr.addColorStop(0,dark);gr.addColorStop(.35,col);gr.addColorStop(.62,tone(col,.45));gr.addColorStop(1,tone(col,.2));g.fillStyle=gr;g.fill();
 g.save();body();g.clip();
 if(tier>=2){g.fillStyle=tone(col,-.55);g.globalAlpha=.45;for(let i=0;i<3;i++){g.beginPath();g.ellipse(-s*.22+i*s*.2,-bh*.1,s*.035,bh*.9,.1,0,7);g.fill()}g.globalAlpha=1}
 let q=g.createRadialGradient(s*.2,-bh*.5,0,s*.2,-bh*.5,s*.6);q.addColorStop(0,"rgba(255,255,255,.4)");q.addColorStop(1,"rgba(255,255,255,0)");g.fillStyle=q;g.fillRect(-s,-s,2*s,2*s);
 q=g.createLinearGradient(nose,0,tail,0);q.addColorStop(0,"rgba(0,0,0,0)");q.addColorStop(1,"rgba(0,10,20,.35)");g.fillStyle=q;g.fillRect(-s,-s,2*s,2*s);
 g.strokeStyle="rgba(0,0,0,.28)";g.lineWidth=Math.max(1,s*.025);g.beginPath();g.moveTo(s*.32,-bh*.6);g.quadraticCurveTo(s*.24,0,s*.32,bh*.6);g.stroke();
 g.fillStyle="rgba(255,255,255,.28)";g.beginPath();g.ellipse(s*.1,-bh*.45,s*.25,bh*.12,-.05,0,7);g.fill();g.restore();
 fin([s*.2,bh*.35/s,s*.12,bh*.9/s,s*.02,bh*.75/s,s*.08,bh*.5/s,s*.2,bh*.35/s].map((v,i)=>i%2?v:v/s),"rgba(0,0,0,.18)");
 body();g.strokeStyle="rgba(0,10,20,.4)";g.lineWidth=Math.max(.8,s*.018);g.stroke();
 const ex=s*.44,ey=-bh*.25,er=s*(tier===3?.045:.055);g.fillStyle="#f0e6c0";g.beginPath();g.arc(ex,ey,er*1.25,0,7);g.fill();g.fillStyle="#080b0e";g.beginPath();g.arc(ex,ey,er,0,7);g.fill();g.fillStyle="rgba(255,255,255,.85)";g.beginPath();g.arc(ex+er*.35,ey-er*.35,er*.35,0,7);g.fill();
 g.strokeStyle="rgba(0,0,0,.45)";g.lineWidth=Math.max(1,s*.02);g.beginPath();g.moveTo(nose,s*.03);g.lineTo(nose-s*(tier===3?.14:.07),s*.05+(tier===3?bh*.15:0));g.stroke()}
// diver: side view facing right, black wetsuit with shading, steel tank, mask, fins, net on a pole
function drawDiver(g,s){g.lineJoin="round";g.lineCap="round";
 const limb=(pts,w,c)=>{g.strokeStyle=c;g.lineWidth=w;g.beginPath();g.moveTo(pts[0]*s,pts[1]*s);for(let i=2;i<pts.length;i+=2)g.lineTo(pts[i]*s,pts[i+1]*s);g.stroke()};
 limb([-.3,.02,-.6,.12,-.82,.06],s*.11,"#14181d");limb([-.3,-.02,-.62,-.04,-.84,-.14],s*.12,"#1e242b");
 g.fillStyle="#d9a400";for(const [y,a] of[[.06,.3],[-.14,-.2]]){g.save();g.translate(-s*.86,y*s);g.rotate(a);g.beginPath();g.moveTo(0,-s*.05);g.lineTo(-s*.26,-s*.1);g.lineTo(-s*.26,s*.08);g.lineTo(0,s*.05);g.closePath();g.fill();g.restore()}
 let q=g.createLinearGradient(0,-s*.36,0,-s*.2);q.addColorStop(0,"#e6ecf0");q.addColorStop(.5,"#8f9aa3");q.addColorStop(1,"#4b545c");g.fillStyle=q;g.beginPath();g.roundRect(-s*.42,-s*.37,s*.52,s*.16,s*.08);g.fill();
 q=g.createLinearGradient(0,-s*.2,0,s*.2);q.addColorStop(0,"#3a434d");q.addColorStop(.5,"#1a1f25");q.addColorStop(1,"#0b0e11");g.fillStyle=q;g.beginPath();g.ellipse(-s*.08,0,s*.4,s*.17,0,0,7);g.fill();
 g.fillStyle="#e2463c";g.fillRect(-s*.3,-s*.17,s*.04,s*.33);
 limb([.15,-.02,.35,.1,.55,.04],s*.08,"#262c33");
 q=g.createRadialGradient(s*.3,-s*.1,1,s*.32,-s*.04,s*.17);q.addColorStop(0,"#4a525c");q.addColorStop(1,"#101317");g.fillStyle=q;g.beginPath();g.arc(s*.32,-s*.04,s*.16,0,7);g.fill();
 q=g.createLinearGradient(0,-s*.15,0,0);q.addColorStop(0,"#bff2ff");q.addColorStop(1,"#3b8fb0");g.fillStyle=q;g.beginPath();g.roundRect(s*.36,-s*.14,s*.15,s*.11,s*.03);g.fill();g.fillStyle="rgba(255,255,255,.7)";g.fillRect(s*.38,-s*.13,s*.04,s*.03);
 g.strokeStyle="#5a4128";g.lineWidth=s*.04;g.beginPath();g.moveTo(s*.45,s*.06);g.lineTo(s*.85,-s*.1);g.stroke();
 g.strokeStyle="rgba(220,235,240,.8)";g.lineWidth=s*.03;g.beginPath();g.ellipse(s*.98,-s*.14,s*.18,s*.22,0,0,7);g.stroke();
 g.strokeStyle="rgba(220,235,240,.35)";g.lineWidth=1;g.beginPath();for(let i=-2;i<=2;i++){g.moveTo(s*.82,-s*.14+i*s*.08);g.lineTo(s*1.14,-s*.14+i*s*.08);g.moveTo(s*.98+i*s*.07,-s*.34);g.lineTo(s*.98+i*s*.07,s*.06)}g.stroke()}
// surfer on a board, side view, board centred at 0,0 on the water line. Shaded skin, wetsuit, hair, board with stringer.
function drawSurfer(g,s,stand){g.lineJoin="round";g.lineCap="round";const skin="#d89a6a",skinD="#a8693f",suit=stand?"#1f4f7a":"#27313b";
 let q=g.createLinearGradient(0,-s*.08,0,s*.09);q.addColorStop(0,stand?"#fdfdf7":"#ffe7b0");q.addColorStop(.5,stand?"#d7e4ea":"#f2c76f");q.addColorStop(1,stand?"#8aa2ae":"#b08436");g.fillStyle=q;g.beginPath();g.moveTo(-s*.7,0);g.quadraticCurveTo(-s*.68,-s*.08,0,-s*.08);g.quadraticCurveTo(s*.62,-s*.08,s*.74,-s*.02);g.quadraticCurveTo(s*.6,s*.08,0,s*.08);g.quadraticCurveTo(-s*.66,s*.08,-s*.7,0);g.fill();
 g.strokeStyle="rgba(40,40,40,.5)";g.lineWidth=1.2;g.beginPath();g.moveTo(-s*.6,-s*.01);g.lineTo(s*.6,-s*.03);g.stroke();
 const limb=(pts,w,c)=>{g.strokeStyle=c;g.lineWidth=w;g.beginPath();g.moveTo(pts[0]*s,pts[1]*s);for(let i=2;i<pts.length;i+=2)g.lineTo(pts[i]*s,pts[i+1]*s);g.stroke()};
 if(stand){limb([-.16,-.07,-.1,-.24,-.04,-.36],s*.08,tone(suit,-.3));limb([.16,-.07,.1,-.24,.04,-.36],s*.085,suit);
  q=g.createLinearGradient(-s*.12,0,s*.12,0);q.addColorStop(0,tone(suit,-.35));q.addColorStop(.5,tone(suit,.15));q.addColorStop(1,tone(suit,-.2));g.fillStyle=q;g.beginPath();g.ellipse(0,-s*.52,s*.1,s*.18,-.08,0,7);g.fill();
  limb([-.06,-.62,-.24,-.56,-.4,-.5],s*.055,skinD);limb([.06,-.63,.22,-.7,.38,-.76],s*.055,skin);
  q=g.createRadialGradient(-s*.03,-s*.8,1,0,-s*.78,s*.1);q.addColorStop(0,tone(skin,.2));q.addColorStop(1,skinD);g.fillStyle=q;g.beginPath();g.arc(0,-s*.78,s*.085,0,7);g.fill();
  g.fillStyle="#3b2414";g.beginPath();g.arc(-s*.01,-s*.81,s*.088,Math.PI*.95,Math.PI*2.05);g.fill()}
 else{limb([-.22,-.07,-.05,-.1,.08,-.07],s*.085,tone(suit,-.2));
  q=g.createLinearGradient(0,-s*.4,0,-s*.08);q.addColorStop(0,tone(suit,.15));q.addColorStop(1,tone(suit,-.3));g.fillStyle=q;g.beginPath();g.ellipse(-s*.08,-s*.24,s*.1,s*.16,.35,0,7);g.fill();
  limb([.0,-.3,.16,-.18,.3,-.1],s*.055,skin);
  q=g.createRadialGradient(s*.02,-s*.46,1,s*.03,-s*.44,s*.1);q.addColorStop(0,tone(skin,.2));q.addColorStop(1,skinD);g.fillStyle=q;g.beginPath();g.arc(s*.03,-s*.44,s*.08,0,7);g.fill();
  g.fillStyle="#d8b04a";g.beginPath();g.arc(s*.02,-s*.47,s*.083,Math.PI*.9,Math.PI*2.05);g.fill()}}
// v8 shark art: realistic side silhouette, no cartoon outline. Origin: shark centre = canvas centre + (L*.05, 0)
function sideSharkPath(g,L,open,T){const h=L*.2,bl=T&&T.stripe?1:0;g.beginPath();g.moveTo(L*.5,h*.05);
 if(T&&T.hammer){g.lineTo(L*.5,-h*.25);g.lineTo(L*.48,-h*.68);g.lineTo(L*.42,-h*.72);g.bezierCurveTo(L*.36,-h*.62,L*.3,-h*.6,L*.2,-h*.68)}
 else g.bezierCurveTo(L*(.48-bl*.01),-h*(.3+bl*.18),L*.36,-h*.6,L*.2,-h*.68);
 g.bezierCurveTo(L*.14,-h*.72,L*.1,-h*.74,L*.07,-h*.76);g.bezierCurveTo(L*.02,-h*1.2,-L*.03,-h*1.6,-L*.07,-h*(T&&T.hammer?2.1:1.85));
 g.quadraticCurveTo(-L*.09,-h*1.1,-L*.17,-h*.62);g.bezierCurveTo(-L*.28,-h*.45,-L*.38,-h*.25,-L*.45,-h*.14);
 g.bezierCurveTo(-L*.5,-h*.5,-L*.56,-h*1.0,-L*.64,-h*1.45);g.quadraticCurveTo(-L*.58,-h*.6,-L*.53,-h*.02);
 g.quadraticCurveTo(-L*.57,h*.45,-L*.6,h*.85);g.quadraticCurveTo(-L*.52,h*.4,-L*.45,h*.14);
 g.bezierCurveTo(-L*.36,h*.3,-L*.28,h*.42,-L*.22,h*.46);g.bezierCurveTo(-L*.05,h*.64,L*.15,h*.68,L*.3,h*.52);
 if(open){g.lineTo(L*.41,h*.44);g.lineTo(L*.26,h*.2);g.lineTo(L*.47,h*.13)}else g.bezierCurveTo(L*.4,h*.44,L*.47,h*.26,L*.5,h*.05);g.closePath()}
// pre-rendered once per size/type: countershaded gradient, depth shading toward the tail, top-light volume highlight, rim light, belly occlusion, baked caustics, gills, fins, glossy eye
function render3DShark(L,open,T){T=T||TYPES.white;const h=L*.2,pad=L*.12,c=mk(L*1.3+pad*2,h*4.6+pad*2),g=c.getContext("2d");g.translate(c.width/2+L*.05,c.height*.56);g.lineJoin="round";
 const fin=(pts,c0,c1)=>{g.beginPath();g.moveTo(L*pts[0],h*pts[1]);g.quadraticCurveTo(L*pts[2],h*pts[3],L*pts[4],h*pts[5]);g.quadraticCurveTo(L*pts[6],h*pts[7],L*pts[8],h*pts[9]);g.closePath();const fg=g.createLinearGradient(L*pts[0],h*pts[1],L*pts[4],h*pts[5]);fg.addColorStop(0,c0);fg.addColorStop(1,c1);g.fillStyle=fg;g.fill()};
 fin([.24,.3,.2,.9,.13,1.3,.15,.8,.12,.4],T.ext,"#0c1218");// far pectoral (behind body)
 sideSharkPath(g,L,open,T);const gr=g.createLinearGradient(0,-h*.8,0,h*.68);gr.addColorStop(0,T.ext);gr.addColorStop(.22,T.body);gr.addColorStop(.47,T.hi);gr.addColorStop(.53,T.belly);gr.addColorStop(.8,T.belly);gr.addColorStop(1,"#7f8b96");g.fillStyle=gr;g.fill();
 g.save();sideSharkPath(g,L,open,T);g.clip();
 if(T.stripe){g.fillStyle=T.stripe;g.globalAlpha=.42;for(let i=0;i<10;i++){const x=-L*.4+i*L*.075;g.beginPath();g.ellipse(x,-h*.32,L*.012,h*.32,.15,0,7);g.fill()}g.globalAlpha=1}
 let q=g.createLinearGradient(L*.5,0,-L*.65,0);q.addColorStop(0,"rgba(0,8,16,0)");q.addColorStop(.55,"rgba(0,8,16,.1)");q.addColorStop(1,"rgba(0,8,16,.5)");g.fillStyle=q;g.fillRect(-L,-h*3,L*2,h*6);
 q=g.createRadialGradient(L*.16,-h*.45,0,L*.16,-h*.45,L*.38);q.addColorStop(0,"rgba(255,255,255,.4)");q.addColorStop(.45,"rgba(255,255,255,.1)");q.addColorStop(1,"rgba(255,255,255,0)");g.fillStyle=q;g.fillRect(-L,-h*3,L*2,h*6);
 g.strokeStyle="rgba(200,240,255,.16)";g.lineWidth=Math.max(1,L*.006);for(let i=0;i<5;i++){const y=-h*(.75-i*.12);g.beginPath();g.moveTo(-L*.45,y);for(let x=-.45;x<.5;x+=.06)g.lineTo(L*x,y+Math.sin(x*40+i*2)*h*.05);g.stroke()}
 g.save();g.translate(0,h*.07);g.lineWidth=h*.09;g.strokeStyle="rgba(200,238,255,.42)";sideSharkPath(g,L,open,T);g.stroke();g.restore();
 g.save();g.translate(0,-h*.09);g.lineWidth=h*.14;g.strokeStyle="rgba(10,20,30,.28)";sideSharkPath(g,L,open,T);g.stroke();g.restore();
 g.fillStyle="rgba(255,255,255,.3)";g.beginPath();g.ellipse(L*.17,-h*.5,L*.15,h*.045,-.08,0,7);g.fill();g.restore();
 for(let i=0;i<5;i++){const x=L*(.25-i*.027);g.lineWidth=Math.max(1,L*.006);g.strokeStyle="rgba(5,12,20,.5)";g.beginPath();g.moveTo(x,-h*.22);g.quadraticCurveTo(x-L*.012,h*.04,x-L*.004,h*.3);g.stroke();g.strokeStyle="rgba(255,255,255,.14)";g.beginPath();g.moveTo(x+L*.005,-h*.2);g.quadraticCurveTo(x-L*.007,h*.04,x+L*.001,h*.28);g.stroke()}
 fin([.17,.32,.13,.9,.0,1.5,.07,.85,.05,.4],T.body,T.ext);fin([-.25,.42,-.28,.7,-.32,.8,-.31,.55,-.32,.38],T.body,T.ext);fin([-.33,-.3,-.35,-.5,-.37,-.55,-.37,-.4,-.39,-.24],T.body,T.ext);
 const ex=T.hammer?L*.47:L*.37,ey=-h*(T.hammer?.52:.26);g.fillStyle="#05080b";g.beginPath();g.ellipse(ex,ey,L*.017,L*.014,0,0,7);g.fill();g.fillStyle="rgba(255,255,255,.85)";g.beginPath();g.arc(ex+L*.005,ey-L*.005,L*.0055,0,7);g.fill();
 if(open){g.fillStyle="#f2efe4";for(let i=0;i<6;i++){const u=i/6,x=L*(.45-u*.17),y=h*(.15+u*.06);g.beginPath();g.moveTo(x,y);g.lineTo(x-L*.012,y+h*.13);g.lineTo(x-L*.024,y+u*h*.01);g.closePath();g.fill()}}
 else{g.strokeStyle="rgba(5,12,20,.45)";g.lineWidth=Math.max(1,L*.006);g.beginPath();g.moveTo(L*.45,h*.3);g.quadraticCurveTo(L*.38,h*.4,L*.29,h*.36);g.stroke()}
 sideSharkPath(g,L,open,T);g.lineWidth=Math.max(1,L*.006);g.strokeStyle="rgba(4,12,22,.55)";g.stroke();
 c.L=L;return c}
function render3DTitle(w){const fs=Math.floor(w*.17),c=mk(w,fs*2.7),g=c.getContext("2d");g.textAlign="center";g.textBaseline="middle";g.font=`900 ${fs}px system-ui,"Arial Black",sans-serif`;g.lineJoin="round";
 const lines=[["SHARK",fs*.85],["ATTACK",fs*1.95]];
 for(const [t,y] of lines){g.fillStyle="rgba(0,20,40,.3)";g.fillText(t,w/2+fs*.12,y+fs*.16);
  for(let i=8;i>0;i--){g.fillStyle=i>1?"#a3271f":P.ink;g.fillText(t,w/2+i*fs*.012,y+i*fs*.012)}
  g.lineWidth=fs*.09;g.strokeStyle=P.ink;g.strokeText(t,w/2,y);
  const gr=g.createLinearGradient(0,y-fs*.5,0,y+fs*.5);gr.addColorStop(0,"#fff27a");gr.addColorStop(.5,"#ffcc33");gr.addColorStop(.51,"#ff9f1c");gr.addColorStop(1,"#f06a12");g.fillStyle=gr;g.fillText(t,w/2,y);
  g.save();g.globalCompositeOperation="source-atop";g.fillStyle="rgba(255,255,255,.35)";g.fillRect(0,y-fs*.45,w,fs*.18);g.restore()}
 return c}
function biteTitle(c,cx,cy,r){// cartoon bite: scalloped chunk removed + dark rim
 const g=c.getContext("2d");g.save();g.globalCompositeOperation="destination-out";g.beginPath();
 for(let i=0;i<6;i++){const a=-Math.PI/2+(i-2.5)*.42;g.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);g.arc(cx+Math.cos(a)*r,cy+Math.sin(a)*r,r*.42,0,7)}
 g.arc(cx,cy+r*.15,r*.95,0,7);g.fill();g.restore();
 g.save();g.globalCompositeOperation="source-atop";g.strokeStyle=P.ink;g.lineWidth=r*.18;g.beginPath();
 for(let i=0;i<6;i++){const a=-Math.PI/2+(i-2.5)*.42;g.moveTo(cx+Math.cos(a)*r+r*.42,cy+Math.sin(a)*r);g.arc(cx+Math.cos(a)*r,cy+Math.sin(a)*r,r*.42,0,7)}g.arc(cx,cy+r*.15,r*.95,0,7);g.stroke();g.restore()}

// head-on shark for the intro: mouth WIDE open toward the viewer (open) or snapped shut (closed). Pre-rendered once.
function renderFrontShark(S,open){const c=mk(S*1.2,S*1.1),g=c.getContext("2d");g.translate(c.width/2,c.height*.48);g.lineJoin="round";const k=S/400;
 const head=()=>{g.beginPath();g.moveTo(-200*k,-10*k);g.bezierCurveTo(-210*k,-150*k,-90*k,-205*k,0,-205*k);g.bezierCurveTo(90*k,-205*k,210*k,-150*k,200*k,-10*k);g.bezierCurveTo(195*k,110*k,110*k,190*k,0,195*k);g.bezierCurveTo(-110*k,190*k,-195*k,110*k,-200*k,-10*k);g.closePath()};
 g.fillStyle="#26313b";g.beginPath();g.moveTo(-30*k,-190*k);g.lineTo(0,-300*k);g.lineTo(30*k,-190*k);g.closePath();g.fill();g.lineWidth=3*k;g.strokeStyle="rgba(6,16,26,.55)";g.stroke();// dorsal fin behind
 for(const sd of[-1,1]){g.fillStyle="#3a4855";g.beginPath();g.moveTo(sd*170*k,60*k);g.quadraticCurveTo(sd*290*k,120*k,sd*300*k,200*k);g.quadraticCurveTo(sd*230*k,150*k,sd*140*k,120*k);g.closePath();g.fill();g.stroke()}// pectoral fins
 g.save();g.translate(10*k,14*k);head();g.fillStyle="rgba(0,10,20,.45)";g.fill();g.restore();
 head();let gr=g.createLinearGradient(0,-205*k,0,195*k);gr.addColorStop(0,"#2c3844");gr.addColorStop(.3,"#5f7181");gr.addColorStop(.5,"#9aa9b5");gr.addColorStop(.58,"#e6eaec");gr.addColorStop(1,"#a9b3bb");g.fillStyle=gr;g.fill();{const rg=g.createRadialGradient(-60*k,-120*k,10*k,0,0,230*k);rg.addColorStop(0,"rgba(255,255,255,.28)");rg.addColorStop(.5,"rgba(255,255,255,0)");rg.addColorStop(1,"rgba(0,8,16,.45)");g.fillStyle=rg;g.fill()}g.lineWidth=3*k;g.strokeStyle="rgba(6,16,26,.55)";g.stroke();
 g.save();head();g.clip();g.fillStyle="rgba(255,255,255,.35)";g.beginPath();g.ellipse(-60*k,-140*k,90*k,30*k,-.3,0,7);g.fill();g.restore();
 for(const sd of[-1,1]){const ex=sd*130*k,ey=-90*k;g.fillStyle="#0b0f14";g.beginPath();g.ellipse(ex,ey,26*k,30*k,sd*.3,0,7);g.fill();g.fillStyle="#fff";g.beginPath();g.arc(ex-sd*8*k,ey-10*k,7*k,0,7);g.fill();
  g.strokeStyle="rgba(6,16,26,.55)";
  g.lineWidth=4*k;g.beginPath();g.ellipse(sd*40*k,-150*k,8*k,4*k,0,0,7);g.stroke()}// nostrils
 if(open){const mw=150*k,mt=-40*k,mb=175*k;g.beginPath();g.moveTo(-mw,mt+20*k);g.quadraticCurveTo(0,mt-30*k,mw,mt+20*k);g.quadraticCurveTo(mw*1.05,mb*.8,0,mb);g.quadraticCurveTo(-mw*1.05,mb*.8,-mw,mt+20*k);g.closePath();
  g.fillStyle="#8a3c46";g.fill();g.lineWidth=3*k;g.strokeStyle="rgba(6,16,26,.55)";g.stroke();// gums
  g.save();g.clip();gr=g.createRadialGradient(0,70*k,10*k,0,70*k,150*k);gr.addColorStop(0,"#05030a");gr.addColorStop(.7,"#1a0d1c");gr.addColorStop(1,"#3a1a2a");g.fillStyle=gr;g.beginPath();g.ellipse(0,72*k,mw*.82,(mb-mt)*.4,0,0,7);g.fill();g.restore();
  g.fillStyle="#efeadb";g.strokeStyle="rgba(6,16,26,.55)";g.lineWidth=3.5*k;
  for(let row=0;row<2;row++){const n=row?7:9;for(let i=0;i<n;i++){const u=(i+.5)/n,x=-mw*.92+u*mw*1.84,yTop=mt+20*k-Math.sin(u*Math.PI)*42*k+row*22*k,tw=mw*1.84/n*.5,th=(row?34:46)*k;g.beginPath();g.moveTo(x-tw,yTop);g.lineTo(x,yTop+th);g.lineTo(x+tw,yTop);g.closePath();g.fill();g.stroke()}}
  for(let i=0;i<8;i++){const u=(i+.5)/8,x=-mw*.8+u*mw*1.6,yb=mb-12*k-Math.sin(u*Math.PI)*28*k,tw=mw*1.6/8*.48;g.beginPath();g.moveTo(x-tw,yb);g.lineTo(x,yb-40*k);g.lineTo(x+tw,yb);g.closePath();g.fill();g.stroke()}}
 else{g.strokeStyle="rgba(6,16,26,.55)";g.lineWidth=3*k;g.beginPath();g.moveTo(-150*k,40*k);g.quadraticCurveTo(0,90*k,150*k,40*k);g.stroke();g.fillStyle="#efeadb";g.lineWidth=3*k;for(let i=0;i<10;i++){const u=(i+.5)/10,x=-130*k+u*260*k,y=40*k+Math.sin(u*Math.PI)*45*k;g.beginPath();g.moveTo(x-11*k,y-2*k);g.lineTo(x,y+18*k);g.lineTo(x+11*k,y-2*k);g.closePath();g.fill();g.stroke()}}
 for(const sd of[-1,1])for(let i=0;i<3;i++){g.strokeStyle="rgba(8,42,61,.6)";g.lineWidth=4*k;g.beginPath();g.moveTo(sd*(165+i*12)*k,-20*k);g.quadraticCurveTo(sd*(175+i*12)*k,20*k,sd*(160+i*12)*k,60*k);g.stroke()}
 return c}

// ---------- world ----------
const shark={stun:0,safe:0,x:0,y:0,ang:0,spd:0,lvl:0,L:70,Lt:70,wag:0,chomp:0,meter:0,run:0,air:false,vx:0,vy:0,h:0,sq:0,cool:0,perfect:false,face:1};
const fish=[],surf=[],parts=[],pops=[];
const divers=[];const amb={on:false,t:0,x:0,y:0,x0:0,y0:0,dir:1,phase:"",lt:0,reachT:-1,ate:false,spr:null,L:0};
let mode=MODES.includes(localStorage.getItem(MODE_KEY))?localStorage.getItem(MODE_KEY):"timed",fasterT=0;
let netHits=0,surfersCaught=0,ambCool=0,bannerT=0,diverTipT=0,diverSpr=null,struggles=0;
for(let i=0;i<CREATURES.N;i++)fish.push({x:0,y:0,vx:0,vy:0,ph:Math.random()*6,tier:0,s:16,kind:"fish",pal:0,danger:false,bump:0,chase:0,rest:0,st:""});
for(let i=0;i<N_SURF;i++)surf.push({x:0,vx:0,ph:Math.random()*6,k:i===0?1:0,zip:0});
for(let i=0;i<MAX_PARTS;i++)parts.push({x:0,y:0,vx:0,vy:0,t:0});
for(let i=0;i<6;i++)pops.push({x:0,y:0,t:0,txt:""});
const waves=[];for(let i=0;i<10;i++)waves.push({x:Math.random(),y:Math.random(),w:20+Math.random()*30,sp:.006+Math.random()*.01});
let score=0,timeLeft=ROUND_SECONDS,best=+(localStorage.getItem(BEST_KEY)||0),elapsed=0,endReason="",shake=0,hintT=0;
let calm=localStorage.getItem(CALM_KEY)==="1"||matchMedia("(prefers-reduced-motion: reduce)").matches;
const touch={on:false,x:0,y:0,dx:0,dy:0,drive:0};
let bg=null,sprC=null,sprO=null,fishSpr=[],surfSpr=[],title=null,tFront=null,tFrontC=null;
const need=l=>GROW.NEED_BASE+GROW.NEED_PER_LVL*l;
const ptsOf=f=>Math.max(1,Math.round(1+3*f.s/bite()))*(f.kind==="fish"?1:2),growOf=f=>GROW.REL*f.s/bite();
let worldK=1/GROW.START,sizeK=1,camY=0,WORLD_H=4000,gradW=null,raysSpr=null,skySpr=null,floorSpr=null,ventSpr=null,vigSpr=null,bgSpr=null,busy=false,sharkSpr=[],glowSpr=[],deco=[],snow=[],fsRot=false;
const depthOf=y=>Math.max(0,Math.min(1,(y-SURF)/(BED-SURF)));
const sharkL=l=>Math.min(W,H)*.24*trait("size");// DRAWN size: fixed all game (v8); growth shrinks the world instead
const bite=()=>shark.L*.4;
function setWorldK(k){const r=k/worldK;if(r!==1)for(const f of fish)f.s*=r;worldK=k}
const surfK=()=>Math.max(.55,Math.min(1.8,worldK));
function rel(f){const r=f.s/bite();return r<.87?-1:r>1.15?1:0}// -1 food, 0 same size (bump), 1 danger
const sharkMax=l=>Math.min(W,H)*.75*(1+.04*l)*trait("speed");
const FISH_PAL=["#ffd23f","#7be04a","#ff7a9c","#5fd0ff","#ff9f1c","#c48bff"],DEEP_PAL=["#6c7fa8","#8a6fb0","#5e8c8a"],GLOW_PAL=["#3dfcff","#ff4fd8","#b6ff3d"];
const SHARK_PALS=[{body:"#55606e",hi:"#7f8b99",belly:"#cfd6dc",ext:"#1f262e",stripe:null,hammer:false},{body:"#3d4a5c",hi:"#5d6b80",belly:"#b9c2cc",ext:"#141a22",stripe:null,hammer:true},{body:"#2a2f3a",hi:"#4a5162",belly:"#8f97a3",ext:"#0b0e13",stripe:"#5b2a1a",hammer:false}];
function tierOf(sz){return sz<22?0:sz<36?1:sz<54?2:3}
function buildSprites(){
 SURF=Math.round(H*WORLD.SKY);WORLD_H=Math.round(H*WORLD.SCREENS);BED=Math.round(WORLD_H-H*WORLD.FLOOR*.62);
 // whole-world water gradient (drawn each frame through the camera transform: 1 fill)
 gradW=X.createLinearGradient(0,SURF,0,WORLD_H);gradW.addColorStop(0,"#2cc0ec");gradW.addColorStop(.08,"#1597cc");gradW.addColorStop(.25,"#0b5f97");gradW.addColorStop(.45,"#0a3767");gradW.addColorStop(.65,"#071b3c");gradW.addColorStop(.8,"#060f24");gradW.addColorStop(.9,"#1a0b10");gradW.addColorStop(1,"#3a1206");
 skySpr=mk(W*DPR,SURF*DPR);{const g=skySpr.getContext("2d");g.scale(DPR,DPR);let gr=g.createLinearGradient(0,0,0,SURF);gr.addColorStop(0,"#5ab8f5");gr.addColorStop(.7,"#a8e0ff");gr.addColorStop(1,"#e4f7ff");g.fillStyle=gr;g.fillRect(0,0,W,SURF);
  gr=g.createRadialGradient(W*.84,SURF*.38,4,W*.84,SURF*.38,SURF*.5);gr.addColorStop(0,"rgba(255,250,200,1)");gr.addColorStop(.25,"rgba(255,240,170,.9)");gr.addColorStop(1,"rgba(255,240,170,0)");g.fillStyle=gr;g.fillRect(0,0,W,SURF);
  for(const [x,y,r] of[[.12,.35,14],[.17,.3,20],[.23,.36,13],[.5,.22,10],[.55,.2,15],[.6,.24,11]]){const cg=g.createLinearGradient(0,SURF*y-r,0,SURF*y+r);cg.addColorStop(0,"#fff");cg.addColorStop(1,"#d6ecf7");g.fillStyle=cg;g.beginPath();g.arc(W*x,SURF*y,r,0,7);g.fill()}
  g.fillStyle="#3c7da6";g.beginPath();g.moveTo(0,SURF);for(let x=0;x<=W*.3;x+=W*.05)g.lineTo(x,SURF-6-Math.sin(x*.03)*5-(x<W*.15?10:0));g.lineTo(W*.3,SURF);g.fill()}// distant island
 raysSpr=mk(W*.5,H*.7);{const g=raysSpr.getContext("2d"),w=raysSpr.width,h=raysSpr.height;for(let i=0;i<7;i++){const x=w*(i/7+.03),gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,"rgba(255,255,230,.22)");gr.addColorStop(1,"rgba(255,255,230,0)");g.fillStyle=gr;g.beginPath();g.moveTo(x,0);g.lineTo(x+w*.06,0);g.lineTo(x+w*.02+w*.12,h);g.lineTo(x-w*.08,h);g.closePath();g.fill()}}
 vigSpr=mk(512,512);{const g=vigSpr.getContext("2d"),gr=g.createRadialGradient(256,256,20,256,256,128);gr.addColorStop(0,"rgba(0,0,8,0)");gr.addColorStop(.45,"rgba(0,0,8,.25)");gr.addColorStop(1,"rgba(0,0,8,.97)");g.fillStyle=gr;g.fillRect(0,0,512,512)}
 // volcanic floor (pre-rendered once): dark basalt, glowing lava cracks
 {const fh=WORLD_H-BED+40;floorSpr=mk(W*DPR,fh*DPR);const g=floorSpr.getContext("2d");g.scale(DPR,DPR);const pts=[];for(let x=0;x<=W+30;x+=30)pts.push([x,40-Math.abs(Math.sin(x*.013)*30)-Math.random()*16+(x%180<40?-30:0)]);
  const rock=g.createLinearGradient(0,0,0,fh);rock.addColorStop(0,"#3a3036");rock.addColorStop(.3,"#211a1f");rock.addColorStop(1,"#0d0a0c");g.fillStyle=rock;g.beginPath();g.moveTo(0,fh);for(const [x,y] of pts)g.lineTo(x,y);g.lineTo(W,fh);g.closePath();g.fill();
  g.strokeStyle="#000";g.lineWidth=3;g.beginPath();for(const [x,y] of pts)g.lineTo(x,y);g.stroke();
  g.strokeStyle="rgba(90,70,80,.6)";g.lineWidth=2;for(let i=0;i<40;i++){const x=Math.random()*W,y=40+Math.random()*(fh-50);g.beginPath();g.moveTo(x,y);g.lineTo(x+rnd(-20,20),y+rnd(4,14));g.stroke()}
  g.lineCap="round";for(let i=0;i<9;i++){let x=rnd(0,W),y=rnd(45,fh*.7);g.shadowColor="#ff5a00";g.shadowBlur=14;g.strokeStyle=i%3?"#ff7a1a":"#ffd24a";g.lineWidth=rnd(2,4);g.beginPath();g.moveTo(x,y);for(let k=0;k<5;k++){x+=rnd(-30,30);y+=rnd(4,18);g.lineTo(x,y)}g.stroke()}
  g.shadowBlur=0;floorSpr.vents=[];for(let i=0;i<4;i++){const x=W*(.12+i*.25)+rnd(-30,30),j=Math.round(x/30),y=pts[Math.min(pts.length-1,j)][1];floorSpr.vents.push(x);g.fillStyle="#1a1416";g.beginPath();g.moveTo(x-40,y+30);g.lineTo(x-12,y-26);g.lineTo(x+12,y-26);g.lineTo(x+40,y+30);g.closePath();g.fill();g.stroke();g.fillStyle="#ff8a1e";g.shadowColor="#ff4a00";g.shadowBlur=18;g.beginPath();g.ellipse(x,y-26,11,4,0,0,7);g.fill();g.shadowBlur=0}
  floorSpr.fh=fh}
 puffSpr=mk(128,128);{const g=puffSpr.getContext("2d"),gr=g.createRadialGradient(56,56,4,64,64,64);gr.addColorStop(0,"rgba(235,60,60,.95)");gr.addColorStop(.55,"rgba(200,30,40,.6)");gr.addColorStop(1,"rgba(170,20,30,0)");g.fillStyle=gr;g.fillRect(0,0,128,128)}
 ventSpr=mk(160,160);{const g=ventSpr.getContext("2d"),gr=g.createRadialGradient(80,80,4,80,80,80);gr.addColorStop(0,"rgba(255,170,60,.9)");gr.addColorStop(.4,"rgba(255,80,20,.35)");gr.addColorStop(1,"rgba(255,40,0,0)");g.fillStyle=gr;g.fillRect(0,0,160,160)}
 // background scenery (parallax silhouettes) by depth: kelp/rocks in the sunlit zone, jellies in twilight, giant squid-ish shapes + rock spires deep
 deco=[];for(let i=0;i<26;i++){const d=i/26,y=SURF+d*(BED-SURF)+rnd(-40,40),k=d<.28?(i%2?"kelp":"rock"):d<.6?"jelly":"spire";deco.push({x:rnd(0,W),y,k,s:rnd(.7,1.4),ph:Math.random()*6})}
 snow=[];for(let i=0;i<46;i++)snow.push({x:Math.random(),y:Math.random(),r:rnd(.6,1.8),sp:rnd(4,12)});
 buildShark();
 {const s=DIVER_SIZE,c=mk(s*2.5*DPR,s*.9*DPR),q=c.getContext("2d");q.scale(DPR,DPR);q.translate(s*1.15,s*.45);drawDiver(q,s);diverSpr=c}
 buildBg();
 const FB=48;fishSpr=[0,1,2,3].map(ti=>FISH_PAL.concat(DEEP_PAL).map(col=>{const s=FB,pad=4,c=mk((s*1.8+pad*2)*DPR,(s*1.05+pad*2)*DPR),q=c.getContext("2d");q.scale(DPR,DPR);q.translate(s*.88+pad,s*.52+pad);drawFish(q,s,col,ti,false);c.base=FB;return c}));
 glowSpr=GLOW_PAL.map(col=>{const s=FB,pad=26,c=mk((s*1.8+pad*2)*DPR,(s*1.05+pad*2)*DPR),q=c.getContext("2d");q.scale(DPR,DPR);q.translate(s*.88+pad,s*.52+pad);q.shadowColor=col;q.shadowBlur=24;drawFish(q,s,col,2,false);q.shadowBlur=0;
  q.fillStyle="#fff";for(let i=0;i<4;i++){q.beginPath();q.arc(-s*.3+i*s*.15,s*.12,2.4,0,7);q.fill()}q.strokeStyle=col;q.lineWidth=2;q.beginPath();q.moveTo(s*.3,-s*.3);q.quadraticCurveTo(s*.6,-s*.8,s*.75,-s*.5);q.stroke();q.fillStyle=col;q.shadowColor=col;q.shadowBlur=14;q.beginPath();q.arc(s*.75,-s*.5,5,0,7);q.fill();c.base=FB;return c});
 sharkSpr=SHARK_PALS.map(T=>{const L=170,c=render3DShark(L*DPR,false,T);c.L=L;c.o=render3DShark(L*DPR,true,T);return c});
 surfSpr=[0,1].map(k=>{const s=60,c=mk(s*1.5*DPR,s*1.1*DPR),q=c.getContext("2d");q.scale(DPR,DPR);q.translate(s*.75,s*.98);drawSurfer(q,s,k);return c});
 const tw=titleW();title=render3DTitle(tw*DPR);title.dw=tw;const L=Math.min(H*.9,420);tFront=renderFrontShark(L*DPR,true);tFrontC=renderFrontShark(L*DPR,false);tFront.L=tFrontC.L=L}
function titleW(){return Math.min(W*.56,H*1.15,560)}
function buildShark(){const L=sharkL(shark.lvl);shark.L=L;sprC=render3DShark(L*DPR,false,TYPES[sType]);sprO=render3DShark(L*DPR,true,TYPES[sType]);sprC.L=sprO.L=L}
let _st=-1;function safeTop(){if(_st<0){const d=document.createElement("div");d.style.cssText="position:fixed;top:env(safe-area-inset-top);";document.body.appendChild(d);_st=d.getBoundingClientRect().top||0;d.remove()}return _st}
function resize(){DPR=Math.min(2,window.devicePixelRatio||1);W=innerWidth;H=innerHeight;C.width=Math.round(W*DPR);C.height=Math.round(H*DPR);buildSprites();if(state!=="play")placeAll()}
function rnd(a,b){return a+Math.random()*(b-a)}
// The whole tall world backdrop (water gradient, sky, light rays, scenery silhouettes, volcanic floor) is painted ONCE into an
// opaque offscreen canvas; each frame is then a single blit of the visible slice. Only small animated bits are drawn live.
function buildBg(){bgSpr=mk(W*DPR,WORLD_H*DPR);const g=bgSpr.getContext("2d",{alpha:false});g.scale(DPR,DPR);g.fillStyle=gradW;g.fillRect(0,0,W,WORLD_H);
 g.setTransform(1,0,0,1,0,0);g.drawImage(skySpr,0,0);g.setTransform(DPR,0,0,DPR,0,0);
 for(let i=0;i<2;i++)g.drawImage(raysSpr,i*W*.5,SURF,W*.5,H*.7);
 g.strokeStyle="rgba(220,250,255,.07)";g.lineWidth=2;for(let i=0;i<70;i++){const x=rnd(0,W),y=SURF+Math.pow(Math.random(),1.6)*H*.9,r=rnd(10,26);g.beginPath();g.moveTo(x-r,y);g.quadraticCurveTo(x,y-r*.5,x+r,y+rnd(-4,4));g.quadraticCurveTo(x+r*.4,y+r*.5,x-r*.2,y+r*.3);g.stroke()}
 for(const o of deco){g.save();g.translate(o.x,o.y);g.scale(o.s,o.s);
  if(o.k==="kelp"){g.strokeStyle="rgba(10,80,70,.55)";g.lineWidth=7;g.lineCap="round";g.beginPath();g.moveTo(0,90);for(let i=0;i<6;i++)g.lineTo(Math.sin(o.ph+i*.7)*10,90-i*30);g.stroke()}
  else if(o.k==="rock"){g.fillStyle="rgba(6,60,90,.45)";g.beginPath();g.moveTo(-60,50);g.lineTo(-30,-30);g.lineTo(10,-50);g.lineTo(50,10);g.lineTo(70,50);g.closePath();g.fill()}
  else if(o.k==="jelly"){g.fillStyle="rgba(150,200,255,.18)";g.beginPath();g.arc(0,0,22,Math.PI,0);g.closePath();g.fill();g.strokeStyle="rgba(150,200,255,.18)";g.lineWidth=2;g.beginPath();for(let i=-2;i<=2;i++){g.moveTo(i*8,0);g.quadraticCurveTo(i*8+3,25,i*8,45)}g.stroke()}
  else{g.fillStyle="rgba(2,6,16,.75)";g.beginPath();g.moveTo(-40,200);g.lineTo(-14,-120);g.lineTo(4,-160);g.lineTo(20,-90);g.lineTo(44,200);g.closePath();g.fill()}g.restore()}
 g.setTransform(1,0,0,1,0,Math.round((BED-40)*DPR));g.drawImage(floorSpr,0,0)}
function setCreature(f,sz,kind){f.s=sz;f.kind=kind;f.tier=tierOf(sz);f.chase=0;f.rest=0;f.bump=0;f.st="";f.pal=kind==="shark"?Math.min(2,Math.floor(rnd(0,3))):kind==="glow"?Math.floor(rnd(0,GLOW_PAL.length)):0}
function spawnFish(f,edge){const P0=state==="play";let cy=P0?shark.y:SURF+H*.4;
 for(let k=0;k<14;k++){f.y=Math.max(SURF+30,Math.min(BED-20,cy+rnd(-1.3,1.3)*H));const side=Math.random()<.5;f.x=(edge||k>3)?(side?-60:W+60):rnd(20,W-20);
  let crowd=false;if(k<10)for(const q of fish)if(q!==f&&q.x>-200&&Math.abs(q.x-f.x)<CREATURES.SPREAD_PX&&Math.abs(q.y-f.y)<CREATURES.SPREAD_PX*.6){crowd=true;break}
  if(!crowd&&(!P0||Math.hypot(f.x-shark.x,f.y-shark.y)>Math.min(W,H)*(elapsed<SAFE_SPAWN_S?.7:.45)))break}
 const d=depthOf(f.y),C=CREATURES;let kind=Math.random()<C.SHARK_P_SHALLOW+(C.SHARK_P_DEEP-C.SHARK_P_SHALLOW)*d?"shark":d>C.GLOW_DEPTH&&Math.random()<.6?"glow":"fish";
 const mx=C.SIZE_SHALLOW+(C.SIZE_DEEP-C.SIZE_SHALLOW)*d;let sz=C.SIZE_MIN+(mx-C.SIZE_MIN)*Math.pow(Math.random(),1.5);sz*=sizeK;if(kind==="shark")sz=Math.max(sz,22+30*d)*rnd(1,1.25);sz*=worldK;
 if(P0&&!(kind==="shark"&&d>.3&&shark.lvl>=GROW.SURF_LVL)&&Math.random()<C.FOOD_SHARE+Math.max(0,GROW.SURF_LVL-shark.lvl)*.03){sz=Math.min(sz,bite()*rnd(.4,.84));if(kind==="shark"&&(sz<20*worldK||d>.3))kind=d>C.GLOW_DEPTH?"glow":"fish"}
 if(kind==="shark"&&P0){let n=0;for(const q of fish)if(q!==f&&q.kind==="shark"&&Math.abs(q.y-f.y)<H*.8)n++;if(n>=C.MAX_BIG)kind=d>C.GLOW_DEPTH?"glow":"fish"}
 if(kind==="glow"&&P0)sz=Math.min(sz,bite()*C.GLOW_MAX);// glowing fish stay modest so the floor reads clearly
 setCreature(f,Math.max(C.SIZE_MIN*worldK,sz),kind);f.pal=kind==="fish"?Math.floor(rnd(0,d>.5?FISH_PAL.length+3:FISH_PAL.length)):f.pal;
 const dir=f.x<W/2?1:-1;f.vx=dir*rnd(25,45)*(f.s>40?.7:1);f.vy=0}
function spawnSurf(s,edge){s.zip=0;s.x=edge?(Math.random()<.5?-50:W+50):rnd(50,W-50);s.vx=(Math.random()<.5?-1:1)*rnd(25,45);s.k=Math.random()<.35?1:0}
function placeAll(){for(const f of fish)spawnFish(f,false);for(const s of surf)spawnSurf(s,false)}

// ---------- audio (one AudioContext, synthesized SFX, capped voices) ----------
const FAST_SFX={AT:.7,COOL:1.5};// bubbles when speed rises past 70% of max (upward crossing only), at most once per 1.5 s
const MAX_VOICES=8;
let AC=null,soundOn=localStorage.getItem(SND_KEY)!=="0",sfx=null,noiseBuf=null,voices=0,music={title:null,game:null,cur:null},chip={buf:null,src:null,bus:null,t0:0,failed:false,want:false},placeholder=null,phT0=0;
const sfxCount={chomp:0,bubbles:0,gulp:0,played:0};// test hooks: requested count per sound; "played" = actually sounded (unmuted)
function initAudio(){if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();sfx=AC.createGain();sfx.gain.value=.45;sfx.connect(AC.destination);
  noiseBuf=AC.createBuffer(1,Math.floor(AC.sampleRate*.12),AC.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length)}catch(e){AC=null}
 music.title=new Audio("audio/title-cathedrale.ogg");music.title.loop=true;music.title.preload="auto";music.title.volume=0;
 loadChip()}
 if(AC&&AC.state==="suspended")AC.resume().catch(()=>{})}
// Gameplay music: Slopcore's 8-bit "Reflets dans l'eau" v2, played as a WebAudio buffer loop (sample-accurate, no gap at the loop point).
// If it fails to load or decode, the original placeholder loop below is the fallback.
const CHIP_URL="audio/gameplay-chiptune.ogg",MUSIC_VOL={title:.8,game:.3};// game track is ~9 dB louder than the title file, so it plays lower to sit under the SFX
function loadChip(){if(!AC||chip.buf||chip.loading)return;chip.loading=true;fetch(CHIP_URL).then(r=>{if(!r.ok)throw new Error("chip "+r.status);return r.arrayBuffer()})
 .then(b=>new Promise((ok,no)=>AC.decodeAudioData(b,ok,no))).then(buf=>{chip.buf=buf;if(chip.want&&placeholder){phStop();chipStart()}}).catch(()=>{chip.failed=true})}
function chipStart(){if(!AC||!chip.buf||chip.src)return;const bus=AC.createGain(),t=AC.currentTime;bus.gain.setValueAtTime(0,t);bus.gain.linearRampToValueAtTime(soundOn?MUSIC_VOL.game:0,t+.6);bus.connect(AC.destination);
 const src=AC.createBufferSource();src.buffer=chip.buf;src.loop=true;src.connect(bus);src.start(t);chip.src=src;chip.bus=bus;chip.t0=t}
function chipStop(){if(!chip.src)return;const s=chip.src,b=chip.bus;try{b.gain.setTargetAtTime(0,AC.currentTime,.15);s.stop(AC.currentTime+.8);setTimeout(()=>b.disconnect(),1000)}catch(e){}chip.src=null;chip.bus=null}
function voice(dur){if(!AC||!soundOn||voices>=MAX_VOICES)return false;voices++;setTimeout(()=>voices--,dur*1000+60);sfxCount.played++;return true}
function blip(f0,f1,dur,type,vol,delay){if(!voice(dur+(delay||0)))return;const t=AC.currentTime+(delay||0),o=AC.createOscillator(),g=AC.createGain();o.type=type||"square";o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(30,f1),t+dur);
 g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(vol||.3,t+.005);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(sfx);o.start(t);o.stop(t+dur+.02)}
function noise(dur,vol,freq){if(!voice(dur))return;const t=AC.currentTime,s=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();s.buffer=noiseBuf;f.type="bandpass";f.frequency.value=freq||1800;f.Q.value=.8;
 g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(f);f.connect(g);g.connect(sfx);s.start(t);s.stop(t+dur)}
const SFX={
 chomp(){sfxCount.chomp++;noise(.07,.35,2200);blip(160,55,.11,"sine",.45)},// short noise burst + low thump
 bubbles(){sfxCount.bubbles++;const n=2+(Math.random()<.5?1:0);for(let i=0;i<n;i++){const f=rnd(380,620);blip(f,f*rnd(2.2,3),.06+Math.random()*.03,"sine",.22,i*rnd(.07,.11))}},// rising sine blips
 gulp(){sfxCount.gulp++;blip(260,110,.16,"sine",.4);blip(180,70,.22,"sine",.4,.17);blip(500,900,.07,"sine",.15,.42)},// cartoon "gul-ulp" + tiny pop
 pop(){blip(500,1200,.09,"triangle",.3);blip(900,1600,.08,"triangle",.22,.07)},
 grow(){[523,659,784,1047].forEach((f,i)=>blip(f,f,.12,"square",.16,i*.09))},
 splash(){noise(.12,.3,900)},launch(){blip(180,520,.18,"triangle",.25)},ripple(){blip(300,420,.08,"sine",.15)},bump(){blip(220,180,.06,"triangle",.18)},
 divers(){[880,660,880,660].forEach((f,i)=>blip(f,f,.11,"square",.14,i*.13))},net(){noise(.1,.25,1400);blip(400,200,.2,"triangle",.25)},ambush(){blip(110,90,.5,"sawtooth",.16);blip(130,100,.45,"sawtooth",.12,.3)},caught(){[523,494,466,440].forEach((f,i)=>blip(f,f,.18,"triangle",.25,i*.15))},
 perfect(){blip(1047,1568,.12,"square",.15)},end(){[784,659,523,392].forEach((f,i)=>blip(f,f*.98,.2,"triangle",.25,i*.16))}};
// FALLBACK only (used if the chiptune file fails to load/decode): tiny ORIGINAL 8-bit loop (not Debussy, not the real track) at BEAT.PLACEHOLDER_BPM, cheap look-ahead scheduler.
const PH_NOTES=[63,70,75,79, 61,68,73,77, 60,67,72,75, 58,65,70,74];const PH_BASS=[39,37,36,34];
function phStart(){if(!AC||placeholder)return;const bus=AC.createGain();bus.gain.value=soundOn?.1:0;bus.connect(AC.destination);let step=0,next=AC.currentTime+.05;phT0=next;const st=30/BEAT.PLACEHOLDER_BPM;
 const tick=()=>{while(next<AC.currentTime+.25){const m=440*Math.pow(2,(PH_NOTES[step%16]-69)/12),o=AC.createOscillator(),g=AC.createGain();o.type="square";o.frequency.value=m;g.gain.setValueAtTime(.5,next);g.gain.exponentialRampToValueAtTime(.01,next+st*.8);o.connect(g);g.connect(bus);o.start(next);o.stop(next+st*.85);
   if(step%4===0){const b=AC.createOscillator(),g2=AC.createGain();b.type="triangle";b.frequency.value=440*Math.pow(2,(PH_BASS[(step>>2)%4]-69)/12);g2.gain.setValueAtTime(.9,next);g2.gain.linearRampToValueAtTime(0,next+st*3.8);b.connect(g2);g2.connect(bus);b.start(next);b.stop(next+st*3.9)}
   step++;next+=st}};placeholder={bus,id:setInterval(tick,100)};tick()}
function phStop(){if(!placeholder)return;clearInterval(placeholder.id);const b=placeholder.bus;try{b.gain.setTargetAtTime(0,AC.currentTime,.2);setTimeout(()=>b.disconnect(),800)}catch(e){}placeholder=null}
let fadeId=0;
function playMusic(which){const id=++fadeId,from=music.cur,to=which==="title"?music.title:null;chip.want=which==="game";
 if(which==="game"){if(chip.buf)chipStart();else phStart()}else{phStop();chipStop()}music.cur=to;if(to&&soundOn)to.play().catch(()=>{});
 let k=0;const step=()=>{if(id!==fadeId)return;k+=.1;if(from&&from!==to)from.volume=Math.max(0,from.volume-.1);if(to)to.volume=soundOn?Math.min(MUSIC_VOL.title,k*MUSIC_VOL.title):0;if(k<1)setTimeout(step,60);else if(from&&from!==to)from.pause()};step()}
function setSound(on){soundOn=on;localStorage.setItem(SND_KEY,on?"1":"0");$("snd").textContent=on?"🔊 Sound on":"🔈 Sound off";if(placeholder)placeholder.bus.gain.value=on?.1:0;if(chip.bus){chip.bus.gain.cancelScheduledValues(AC.currentTime);chip.bus.gain.value=on?MUSIC_VOL.game:0}
 for(const a of[music.title])if(a){if(on&&a===music.cur){a.volume=MUSIC_VOL.title;a.play().catch(()=>{})}else a.volume=0}}

// ---------- title ----------
// Intro: the shark rushes at the screen out of the deep, mouth WIDE open, over the title words, and CHOMPS a bite out of them.
const T={t:0,bitten:false,done:false,shX:0,k:0};const TITLE_TOP_PAD=6,TITLE_SWIM=2.4,TITLE_BITE_AT=1.25;
function startTitle(){state="title";camY=0;T.t=0;T.bitten=false;T.done=false;window.__saTitleDone=false;const tw=titleW();title=render3DTitle(tw*DPR);title.dw=tw;show("titleUi")}
function titleRect(){const tw=title.dw,th=title.height*(tw/title.width);return {x:(W-tw)/2,y:Math.max(safeTop()+10,H*.09),w:tw,h:th}}
function updTitle(dt){T.t+=dt;const r=titleRect(),biteX=r.x+r.w*.56;
 if(!T.bitten&&T.t>=TITLE_BITE_AT){T.bitten=true;biteTitle(title,(biteX-r.x)/r.w*title.width,title.height*.55,title.height*.26);SFX.chomp();if(!calm)shake=.25;addPop(biteX,r.y+r.h*.95,"CHOMP!");for(let i=0;i<14;i++)spark(biteX,r.y+r.h*.6,1)}
 if(shake>0){shake-=dt;C.style.transform=shake>0?`translate(${(Math.random()-.5)*8}px,${(Math.random()-.5)*8}px)`:""}
 if(!T.done&&T.t>TITLE_SWIM+.3){T.done=true;window.__saTitleDone=true}}
function drawTitle(t){const r=titleRect(),cx=r.x+r.w*.5,cy=r.y+r.h*.5;const before=T.t<TITLE_BITE_AT;
 const S=tFront.width/DPR/1.2,full=Math.min(r.w*1.15/S,(H*.95)/(S*1.1),(cy-TITLE_TOP_PAD)/(S*.703));// at full size the open jaws frame the title words
 const sh=(spr,sc,yo,a)=>{const dw=spr.width/DPR*sc,dh=spr.height/DPR*sc,my=dh*.48+70/400*S*sc;X.globalAlpha=a;X.drawImage(spr,cx-dw/2,cy-my+yo,dw,dh);T.sr={x:cx-dw/2,y:cy-my+yo,w:dw,h:dh,head:cy-my+yo+dh*(.48-205/1.1/400*1.0)};X.globalAlpha=1};
 if(T.t<TITLE_SWIM&&before){const p=T.t/TITLE_BITE_AT,e=p*p;T.k=e;sh(tFront,full*(.15+.85*e),(1-e)*H*.3,Math.min(1,.2+p*1.3));X.globalAlpha=.55+.45*p;X.drawImage(title,r.x,r.y,r.w,r.h);X.globalAlpha=1;return}
 if(T.t<TITLE_SWIM){const q=(T.t-TITLE_BITE_AT)/(TITLE_SWIM-TITLE_BITE_AT);sh(q<.3?tFrontC:tFront,full*(1-q*.75),q*q*H*.7,Math.max(0,1-q*1.15))}
 X.drawImage(title,r.x,r.y+(T.t<TITLE_SWIM?0:Math.sin(t*1.5)*3),r.w,r.h);
 if(T.t>=TITLE_SWIM){const fx=W/2+Math.cos(t*.6)*W*.3,fy=SURF;X.fillStyle=TYPES[sType].body;X.strokeStyle=P.ink;X.lineWidth=3;X.beginPath();X.moveTo(fx-16,fy);X.lineTo(fx+(Math.sin(t*.6)>0?-6:6),fy-30);X.lineTo(fx+16,fy);X.closePath();X.fill();X.stroke()}}

// ---------- play ----------
let lastBub=-9,wasFast=false;
function startGame(){hideAll();state="play";score=0;elapsed=0;endReason="";roundLen=window.__saRound||ROUND_SECONDS;timeLeft=roundLen;
 shark.lvl=0;shark.meter=0;shark.dead=false;dead.t=0;worldK=1/trueGrow(0);buildShark();shark.Lt=shark.L;shark.x=W/2;shark.y=SURF+H*.45;sizeK=Math.min(1.25,Math.max(.75,bite()/CREATURES.REF_BITE));camY=Math.max(0,shark.y-H*.5);shark.ang=0;shark.spd=sharkMax(0)*.25;shark.run=0;shark.air=false;shark.h=0;shark.cool=0;shark.sq=0;
 touch.on=false;touch.drive=0;shake=0;shark.stun=0;shark.safe=0;divers.length=0;amb.on=false;amb.ate=false;netHits=0;surfersCaught=0;ambCool=0;bannerT=0;diverTipT=0;fasterT=0;struggles=0;touch.strug=0;wasFast=false;lastBub=-9;for(const p of parts)p.t=0;for(const p of pops)p.t=0;placeAll();playMusic("game");
 hintT=localStorage.getItem(HINT_KEY)?0:6;localStorage.setItem(HINT_KEY,"1")}
function spark(x,y,big){for(const p of parts)if(p.t<=0){const a=Math.random()*6.28,v=rnd(40,140)*(big?1.4:1);p.x=x;p.y=y;p.vx=Math.cos(a)*v;p.vy=Math.sin(a)*v-(big?60:0);p.t=.5;return}}
function addPop(x,y,txt){let o=pops[0];for(const p of pops)if(p.t<o.t)o=p;o.x=Math.max(50,Math.min(W-50,x));o.y=y;o.t=1;o.txt=txt}
function addScore(n){score+=n}
function feedSurfer(){feed(GROW.SURFER)}
function feed(g){if(shark.lvl>=MAX_LEVEL){shark.meter=need(shark.lvl);return}shark.meter+=g*trait("grow");
 while(shark.meter>=need(shark.lvl)&&shark.lvl<MAX_LEVEL){shark.meter-=need(shark.lvl);shark.lvl++;SFX.grow();addPop(shark.x,shark.y-shark.L*.6,"BIGGER!")}}
function beatLen(){return 60/(chip.src?BEAT.CHIPTUNE_BPM:BEAT.PLACEHOLDER_BPM)}
function beatNow(){if(chip.src)return (AC.currentTime-chip.t0)%chip.buf.duration;if(placeholder&&AC)return AC.currentTime-phT0;return elapsed}
function mouth(){const k=shark.L*.48;return [shark.x+Math.cos(shark.ang)*k,shark.y+Math.sin(shark.ang)*k]}
function angDiff(a,b){let d=b-a;while(d>Math.PI)d-=6.2832;while(d<-Math.PI)d+=6.2832;return d}
function power(){const max=sharkMax(shark.lvl);return Math.min(1,LAUNCH.K*(shark.spd/max)*(shark.run/H))}
function canLaunch(){return shark.spd>=sharkMax(shark.lvl)*LAUNCH.MIN_SPEED&&power()>=LAUNCH.MIN_POWER}
function launch(){const p=power(),g0=LAUNCH.G*H,hm=LAUNCH.H_MAX*H*p*trait("leap"),vy0=Math.sqrt(2*g0*hm);let T=2*vy0/g0,g=g0,assisted=false;
 if(BEAT.on){const bl=beatLen(),tl=beatNow()+T,d=Math.round(tl/bl)*bl-tl;if(Math.abs(d)*1000<=BEAT.ASSIST_MS){T+=d;g=2*vy0/T;assisted=true}}// time-stretch the arc so it lands on the beat
 shark.air=true;shark.g=g;shark.vy=-vy0;shark.vx=Math.cos(shark.ang)*shark.spd*.85;shark.perfect=assisted;shark.sq=.12;shark.run=0;shark.peak=vy0*vy0/(2*g);
 window.__saLastLaunch={power:p,height:shark.peak,air:T,base:2*vy0/g0,assisted};SFX.launch();SFX.splash();for(let i=0;i<8;i++)spark(shark.x,SURF,1);addPop(shark.x,SURF-20,p>.7?"BIG AIR!":"WHOOSH!")}
function fmtT(t){t=Math.floor(t);return Math.floor(t/60)+":"+String(t%60).padStart(2,"0")}
function bestKey(){return mode==="endless"?BEST_KEY+"_endless":BEST_KEY}
function setMode(m){mode=m;localStorage.setItem(MODE_KEY,m);for(const k of MODES){const b=$("mode_"+k);if(b){b.classList.toggle("sel",k===m);b.setAttribute("aria-pressed",k===m)}}}
let godMode=false;// test hook only: never set by the game
const DEATH_S=1.5,dead={t:0,puffs:[]};let puffSpr=null;
function gameOver(why){if(godMode&&why==="eaten")return;endReason=why;if(why==="eaten"&&state==="play"){state="dead";shark.dead=true;shark.air=false;shark.stun=0;dead.t=0;dead.puffs=[];for(let i=0;i<6;i++)dead.puffs.push({a:rnd(0,6.28),d:rnd(.05,.3),k:rnd(.6,1.1),dl:i*.08});return}endRound()}
function updDead(dt){dead.t+=dt;shark.y=Math.min(BED-shark.L*.15,shark.y+dt*22);if(shake>0)shake-=dt;{const tc=Math.max(0,shark.y-H*.5);camY+=(tc-camY)*Math.min(1,dt*WORLD.CAM_EASE)}if(dead.t>=DEATH_S)endRound()}
function struggle(d){touch.strug=(touch.strug||0)+d;while(touch.strug>=Math.min(W,H)*STRUGGLE_PX&&shark.stun>0){touch.strug-=Math.min(W,H)*STRUGGLE_PX;shark.stun=Math.max(0,shark.stun-STRUGGLE_SHORTEN_MS/1000);struggles++;spark(shark.x,shark.y,0);SFX.bump()}}
function surferCaught(){surfersCaught++;{const x=surfersCaught-DIVER_TRIGGER_SURFERS;if(x>0&&x%DIVER_SPEEDUP_HINT_EVERY===0&&diverSpeedMul(x-DIVER_SPEEDUP_HINT_EVERY)<DIVER_SPEED_CAP/DIVER_SPEED_FRACTION)fasterT=2.2}const want=Math.min(DIVER_MAX,Math.floor(surfersCaught/DIVER_TRIGGER_SURFERS));while(divers.length<want)spawnDiver()}
function spawnDiver(x,y){let bx=0,by=0,bd=-1;
 for(let k=0;k<6;k++){const e=k%3,cx=e===0?-30:e===1?W+30:rnd(40,W-40),cy=e===2?SURF+20:rnd(SURF+40,Math.min(BED-40,SURF+H*CREATURES.DIVER_BAND)),d=Math.hypot(cx-shark.x,cy-shark.y)-divers.reduce((m,o)=>Math.hypot(cx-o.x,cy-o.y)<80?m+999:m,0);if(d>bd){bd=d;bx=cx;by=cy}}// edge or surface, farthest from the shark
 const d={x:x??bx,y:y??by,ang:0,st:"wander",grace:DIVER_GRACE_MS/1000,cool:0,lost:0,wt:0,ph:Math.random()*6};d.ang=Math.atan2(shark.y-d.y,shark.x-d.x);divers.push(d);
 bannerT=1.5;SFX.divers();if(!localStorage.getItem(DIVER_TIP_KEY)){diverTipT=4.5;localStorage.setItem(DIVER_TIP_KEY,"1")}return d}
function diverSpeedMul(extra){return 1+DIVER_SPEEDUP_PER_SURFER*Math.max(0,extra)}
function diverSpeed(){const top=sharkMax(shark.lvl);return Math.min(top*DIVER_SPEED_FRACTION*diverSpeedMul(surfersCaught-DIVER_TRIGGER_SURFERS),top*DIVER_SPEED_CAP)}
function netPt(d){return [d.x+Math.cos(d.ang)*DIVER_SIZE*.98,d.y+Math.sin(d.ang)*DIVER_SIZE*.98]}
function wantAmbush(n){if(amb.on||ambCool>0)return false;const r=AMBUSH_ON_HIT[Math.min(n,3)];if(r!==null)return r;if(window.__saAmbushForce!=null)return window.__saAmbushForce;return Math.random()<AMBUSH_CHANCE}
function netHit(d){netHits++;if(d)d.cool=DIVER_COOLDOWN_MS/1000;SFX.net();addPop(shark.x,shark.y-shark.L*.5,"NETTED!");shark.meter=Math.max(0,shark.meter-DIVER_GROWTH_LOSS);
 if(mode==="timed"&&netHits>=DIVER_CATCHES_TO_LOSE){gameOver("caught");return}
 const a=wantAmbush(mode==="endless"?Math.min(netHits,2):netHits);shark.stun=(a?AMBUSH_STUN_MS:STUN_MS)/1000;touch.strug=0;if(a)startAmbush()}
function startAmbush(){const L=shark.L*AMBUSHER_SIZE;amb.on=true;amb.t=0;amb.phase="come";amb.reachT=-1;amb.ate=false;amb.dir=shark.x<W/2?-1:1;// enters from the farther edge
 amb.x0=amb.dir<0?W+L*.7:-L*.7;amb.y0=Math.max(SURF+L*.25,Math.min(BED-L*.25,shark.y+rnd(-40,40)));amb.x=amb.x0;amb.y=amb.y0;
 if(amb.L!==L||!amb.spr){amb.L=L;amb.spr=render3DShark(L*DPR,true,AMB_T);amb.spr.L=L}ambCool=AMBUSH_COOLDOWN_MS/1000;SFX.ambush();window.__saLastAmbush=amb}
function updDivers(dt){if(ambCool>0)ambCool-=dt;if(bannerT>0)bannerT-=dt;if(diverTipT>0)diverTipT-=dt;
 const v=diverSpeed(),range=H*DIVER_DETECT_RANGE,L=shark.L;
 for(const d of divers){d.ph+=dt*5;if(d.grace>0)d.grace-=dt;if(d.cool>0)d.cool-=dt;const dist=Math.hypot(shark.x-d.x,shark.y-d.y);
  if(d.cool>0){d.st="wander";d.wa=Math.atan2(d.y-shark.y,d.x-shark.x);d.wt=.5}else   if(dist<range&&!shark.air){d.st="chase";d.lost=0}else if(d.st==="chase"){d.lost+=dt;if(d.lost*1000>=DIVER_GIVEUP_MS)d.st="wander"}
  let tgt,sp;if(d.st==="chase"){tgt=Math.atan2(shark.y-d.y,shark.x-d.x);sp=v}else{d.wt-=dt;if(d.wt<=0){d.wt=rnd(1.2,2.5);d.wa=d.ang+rnd(-1.4,1.4)}tgt=d.wa??d.ang;sp=v*.45}
  d.ang+=angDiff(d.ang,tgt)*Math.min(1,dt*2.5);d.x+=Math.cos(d.ang)*sp*dt;d.y+=Math.sin(d.ang)*sp*dt;
  if(d.y<SURF+16){d.y=SURF+16;d.ang=Math.abs(d.ang)}{const lim=Math.min(BED-20,SURF+H*CREATURES.DIVER_BAND*1.15);if(d.y>lim){d.y=lim;d.ang=-Math.abs(d.ang)}}// stays in the water
  if(d.x<-40){d.x=-40;d.ang=Math.PI-d.ang;d.wa=0}else if(d.x>W+40){d.x=W+40;d.ang=Math.PI-d.ang;d.wa=Math.PI}
  if(d.grace<=0&&d.cool<=0&&!shark.air&&shark.stun<=0&&shark.safe<=0){const [nx,ny]=netPt(d),r=L*DIVER_NET_REACH+8;if((nx-shark.x)**2+(ny-shark.y)**2<r*r){netHit(d);if(state!=="play")return}}}
 if(amb.on){amb.t+=dt;const La=amb.L;
  if(amb.phase==="come"){const k=Math.min(1,amb.t*1000/AMBUSH_ARRIVE_MS),e=k*k*(3-2*k);amb.x=amb.x0+(shark.x-amb.dir*L*.2-amb.x0)*e;amb.y=amb.y0+(shark.y-amb.y0)*e;
   if(Math.hypot(amb.x-shark.x,amb.y-shark.y)<La*.15&&amb.reachT<0)amb.reachT=amb.t;
   if(k>=1){if(shark.stun>0&&!shark.air){amb.ate=true;gameOver("eaten");return}amb.phase="leave";amb.lt=0;addPop(shark.x,shark.y-L*.6,"ESCAPED!")}}
  else{amb.lt+=dt;const sp=amb.lt*1000<AMBUSHER_LEAVE_MS?40:320;amb.x-=amb.dir*sp*dt;amb.y+=Math.sin(amb.lt*2)*20*dt;// circles off slowly, then swims away
   if(amb.lt*1000>=AMBUSHER_LEAVE_MS&&(amb.x<-La||amb.x>W+La))amb.on=false}}}
function updPlay(dt){elapsed+=dt;if(fasterT>0)fasterT-=dt;if(mode==="timed")timeLeft-=dt;if(hintT>0)hintT-=dt;if(mode==="timed"&&timeLeft<=0){timeLeft=0;gameOver("time");return}
 {const wt=1/trueGrow(shark.lvl);if(worldK!==wt){let nk=worldK+(wt-worldK)*Math.min(1,dt*GROW.EASE);if(Math.abs(nk-wt)<1e-4)nk=wt;setWorldK(nk)}}if(shake>0)shake-=dt;if(shark.cool>0)shark.cool-=dt;if(shark.sq>0)shark.sq-=dt;shark.wag+=dt*(4+shark.spd/40);if(shark.chomp>0)shark.chomp-=dt;
 const max=sharkMax(shark.lvl),L=shark.L;
 if(shark.air){// ballistic arc: safe from fish, can grab surfers
  shark.vy+=shark.g*dt;shark.x+=shark.vx*dt;shark.y+=shark.vy*dt;shark.ang=Math.atan2(shark.vy,shark.vx);shark.h=Math.max(0,SURF-shark.y);
  if(shark.x<L*.3||shark.x>W-L*.3){shark.vx=-shark.vx;shark.x=Math.max(L*.3,Math.min(W-L*.3,shark.x))}
  if(shark.y>=SURF&&shark.vy>0){shark.air=false;shark.h=0;shark.y=SURF+2;shark.spd=Math.min(max,Math.hypot(shark.vx,shark.vy)*.6);shark.cool=LAUNCH.COOL;SFX.splash();if(!calm)shake=.22;shark.sq=.12;
   for(let i=0;i<12;i++)spark(shark.x,SURF,1);const bl=beatLen(),off=Math.abs(((beatNow()+bl/2)%bl)-bl/2)*1000;window.__saLastLand={offMs:off};
   if(BEAT.on&&off<=BEAT.PERFECT_MS){addScore(BEAT.PERFECT_BONUS);SFX.perfect();addPop(shark.x,SURF-30,"PERFECT! +"+BEAT.PERFECT_BONUS)}}}
 else{
  if(shark.safe>0&&shark.stun<=0)shark.safe-=dt;
  if(shark.stun>0){shark.stun=Math.max(0,shark.stun-dt);shark.safe=DIVER_SAFE_AFTER_STUN_MS/1000;touch.drive=0;shark.ang+=Math.sin(elapsed*25)*dt*2}
  else if(touch.on){shark.ang+=angDiff(shark.ang,touch.dir)*Math.min(1,dt*STEER.TURN*trait("turn"));if(performance.now()-touch.lastMove>80)touch.drive=Math.max(0,touch.drive-dt*STEER.DRIVE_DECAY)}
  else touch.drive=Math.max(0,touch.drive-dt*STEER.DRIVE_DECAY*2);
  const tgt=shark.stun>0?0:max*(touch.on?STEER.MIN+(1-STEER.MIN)*touch.drive:STEER.MIN);
  shark.spd+=(tgt-shark.spd)*Math.min(1,dt*(tgt>shark.spd?STEER.ACC*trait("acc"):STEER.DEC));// eased = weighty
  shark.x+=Math.cos(shark.ang)*shark.spd*dt;shark.y+=Math.sin(shark.ang)*shark.spd*dt;
  if(shark.spd>max*.45)shark.run+=shark.spd*dt*(shark.spd/max);else shark.run*=Math.exp(-dt*2);shark.run=Math.min(shark.run,H*1.2);
  const fr=shark.spd/max;if(fr>=FAST_SFX.AT&&!wasFast&&elapsed-lastBub>=FAST_SFX.COOL){SFX.bubbles();lastBub=elapsed;for(let i=0;i<3;i++)spark(shark.x-Math.cos(shark.ang)*L*.5,shark.y,0)}wasFast=fr>=FAST_SFX.AT;
  // surface: launch if fast with enough run-up, else bump back down with a ripple
  if(shark.y-L*.08<=SURF){if(Math.sin(shark.ang)<LAUNCH.UP&&shark.cool<=0&&canLaunch())launch();
   else{shark.y=SURF+L*.08;const sn=Math.sin(shark.ang);if(sn<-.5){shark.ang=-shark.ang;shark.spd*=.75;shark.run*=.5;SFX.ripple();addPop(shark.x,SURF+10,"splish");spark(shark.x,SURF,0)}else if(sn<0)shark.ang=Math.cos(shark.ang)>=0?0:Math.PI}}// steep: bump down; shallow: glide along the surface without losing speed
  if(!shark.air){const b=BED-L*.12;if(shark.y>b){shark.y=b;shark.ang=-Math.abs(shark.ang)}
   if(shark.x<L*.35){shark.x=L*.35;shark.ang=Math.PI-shark.ang}else if(shark.x>W-L*.35){shark.x=W-L*.35;shark.ang=Math.PI-shark.ang}}}
 {const tc=Math.max(0,Math.min(WORLD_H-H,shark.y-H*.5));camY+=(tc-camY)*Math.min(1,dt*WORLD.CAM_EASE)}
 updDivers(dt);if(state!=="play")return;
 const [mx,my]=mouth(),er=L*.2;
 const CR=CREATURES,smax=max,sense=H*CR.SENSE;
 for(const f of fish){f.ph+=dt*3;const dx=f.x-shark.x,dy=f.y-shark.y,d2=dx*dx+dy*dy,r=rel(f),dist=Math.sqrt(d2)||1;f.danger=r>0&&f.kind==="shark";if(f.rest>0)f.rest-=dt;
  let tvx=f.vx>=0?Math.max(20,Math.abs(f.vx)):-Math.max(20,Math.abs(f.vx)),tvy=0;f.st="";
  if(!shark.air&&dist<sense){if(r<0){const v=smax*CR.FLEE;tvx=dx/dist*v;tvy=dy/dist*v;f.st="flee"}
   else if(r>0&&f.kind==="shark"&&f.rest<=0&&depthOf(f.y)>=CR.CHASE_MIN_D){const dd=depthOf(f.y),v=smax*(CR.CHASE_SHALLOW+(CR.CHASE_DEEP-CR.CHASE_SHALLOW)*dd);tvx=-dx/dist*v;tvy=-dy/dist*v;f.st="chase";f.chase+=dt;if(f.chase>=CR.GIVEUP_S){f.chase=0;f.rest=CR.REST_S}}}
  else if(f.chase>0)f.chase=Math.max(0,f.chase-dt);
  if(f.st){const k=Math.min(1,dt*2.2);f.vx+=(tvx-f.vx)*k;f.vy+=(tvy-f.vy)*k}else{f.vy*=.97;if(Math.abs(f.vx)<20)f.vx=(f.vx<0?-1:1)*30}
  f.x+=f.vx*dt;f.y+=(f.vy+Math.sin(f.ph)*8)*dt;if(f.y<SURF+f.s*.6){f.y=SURF+f.s*.6;f.vy=Math.abs(f.vy)}if(f.y>BED-f.s*.4){f.y=BED-f.s*.4;f.vy=-Math.abs(f.vy)}
  if(f.st==="flee"){if(f.x<-f.s*2||f.x>W+f.s*2){spawnFish(f,true);continue}}else if(f.x<-f.s*2.5)f.x=W+f.s*2;else if(f.x>W+f.s*2.5)f.x=-f.s*2;
  if(Math.abs(f.y-shark.y)>H*1.7){spawnFish(f,true);continue}if(f.bump>0)f.bump-=dt;
  if(shark.air)continue;
  if(r<0){const ex=f.x-mx,ey=f.y-my,rr=er+f.s*.4;if(ex*ex+ey*ey<rr*rr){const pts=ptsOf(f);addScore(pts);feed(growOf(f));SFX.chomp();shark.chomp=.2;addPop(f.x,f.y,"+"+pts);for(let i=0;i<4;i++)spark(f.x,f.y,0);spawnFish(f,true)}}
  else{const rr=L*.32+f.s*(f.kind==="shark"?.9:.4);if(d2<rr*rr){if(r>0&&f.kind==="shark"){const dir=f.vx<0?-1:1,fx=f.x+dir*f.s*(f.kind==="shark"?1.1:.45),qx=fx-shark.x,qy=f.y-shark.y,q=L*.34+f.s*.2;if(qx*qx+qy*qy<q*q){gameOver("eaten");return}}
    f.vy+=dy/dist*80;shark.x-=dx/dist*6;shark.y-=dy/dist*6;if(f.bump<=0){SFX.bump();f.bump=.4;if(r>=0&&(shark.tooT||0)<elapsed-1.2){shark.tooT=elapsed;addPop(shark.x,shark.y-L*.55,"Too small!")}}}}}
 for(const s of surf){s.ph+=dt*2;if(s.zip>0){s.zip-=dt;if(s.zip<=0)spawnSurf(s,true);continue}
  s.x+=s.vx*dt;if(s.x<-60)s.x=W+55;else if(s.x>W+60)s.x=-55;const sk=surfK(),hy=SURFERS[s.k].hy*sk,cx=s.x,cy=SURF-hy;
  if(shark.air){const ex=cx-mx,ey=cy-my,rr=(L*.22+18*sk)*trait("catchR");if(ex*ex+ey*ey<rr*rr&&shark.lvl<GROW.SURF_LVL){if(!(s.bump>0)){s.bump=.8;SFX.bump();addPop(cx,cy-20,"Too small!")}}
  else if(ex*ex+ey*ey<rr*rr){const pts=SURFERS[s.k].pts;addScore(pts);feedSurfer();SFX.pop();shark.chomp=.25;addPop(cx,cy-20,"+"+pts+" SPLASH!");for(let i=0;i<8;i++)spark(cx,SURF,1);s.zip=1.6;surferCaught()}}
  else if(Math.abs(cx-mx)<L*.4&&my<SURF+L*.3&&!(s.bump>0)){s.bump=.6;s.vx=(cx>shark.x?1:-1)*60;SFX.bump();addPop(cx,cy-20,"boing")}
  if(s.bump>0)s.bump-=dt}
 for(const p of parts)if(p.t>0){p.t-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.94;p.vy=p.vy*.94+140*dt}}
function wT(){X.setTransform(DPR,0,0,DPR,0,-camY*DPR)}// world -> screen
function edgeArrow(wx,wy,col){const sx=wx,sy=wy-camY;if(sx>-10&&sx<W+10&&sy>-10&&sy<H+10)return;const ex=Math.max(18,Math.min(W-18,sx)),ey=Math.max(70,Math.min(H-18,sy)),a=Math.atan2(sy-ey,sx-ex);
 X.save();X.translate(ex,ey);X.rotate(a);X.fillStyle=col;X.strokeStyle=P.ink;X.lineWidth=3;X.beginPath();X.moveTo(13,0);X.lineTo(-9,-12);X.lineTo(-9,12);X.closePath();X.fill();X.stroke();X.restore()}
function drawPlay(t){
 X.font="900 22px system-ui,sans-serif";X.textAlign="center";X.textBaseline="middle";X.lineWidth=5;X.strokeStyle=P.ink;const top=camY-120,bot=camY+H+120;
 let onScr=0;for(const f of fish){if(f.y<top||f.y>bot||f.x<-f.s*3||f.x>W+f.s*3)continue;onScr++;let s,sc;const flip=f.vx<0?-1:1;
  if(f.kind==="shark"){const sp=sharkSpr[f.pal];s=f.st==="chase"&&Math.sin(t*8+f.ph)>0?sp.o:sp;sc=(f.s*2.5)/sp.L;X.setTransform(DPR*flip*sc,0,0,DPR*sc,f.x*DPR,(f.y-camY)*DPR);X.rotate(Math.max(-.5,Math.min(.5,f.vy/(Math.abs(f.vx)+40)))*flip);const dw=s.width/DPR,dh=s.height/DPR;X.drawImage(s,-dw/2-sp.L*.05,-dh/2,dw,dh)}
  else{s=f.kind==="glow"?glowSpr[f.pal]:fishSpr[f.tier][f.pal];sc=f.s/s.base;X.setTransform(DPR*flip*sc,0,0,DPR*sc,f.x*DPR,(f.y-camY)*DPR);const dw=s.width/DPR,dh=s.height/DPR;X.drawImage(s,-dw/2,-dh/2,dw,dh)}}
 busy=divers.length>0||amb.on||onScr>14;
 wT();
 for(const f of fish){if(!f.danger||f.y<top||f.y>bot)continue;const rx=f.kind==="shark"?f.s*1.4:f.s*.8,ry=f.kind==="shark"?f.s*.55:f.s*.42;X.lineWidth=3;X.strokeStyle=f.st==="chase"?"#ff2a2a":"rgba(255,60,60,.6)";X.beginPath();X.ellipse(f.x,f.y,rx,ry,0,0,7);X.stroke();
  X.lineWidth=5;X.strokeStyle=P.ink;X.fillStyle="#ff2a2a";X.strokeText("!",f.x,f.y-ry-12);X.fillText("!",f.x,f.y-ry-12)}
 for(const s of surf){if(s.zip>0||SURF>bot)continue;const sp=surfSpr[s.k],dw=sp.width/DPR,dh=sp.height/DPR,y=SURF+Math.sin(s.ph)*2;{const k=surfK();X.setTransform((s.vx<0?-DPR:DPR)*k,0,0,DPR*k,s.x*DPR,(y-camY)*DPR)}X.drawImage(sp,-dw/2,-dh*.89,dw,dh)}
 for(const d of divers){const f=Math.cos(d.ang)<0?-1:1,dw=diverSpr.width/DPR,dh=diverSpr.height/DPR;X.setTransform(DPR*f,0,0,DPR,d.x*DPR,(d.y-camY+Math.sin(d.ph)*2)*DPR);X.rotate(f>0?d.ang:-(d.ang-Math.PI));X.globalAlpha=d.grace>0?.55:1;X.drawImage(diverSpr,-DIVER_SIZE*1.15,-DIVER_SIZE*.45,dw,dh);X.globalAlpha=1}
 if(amb.on){const s=amb.spr,dw=s.width/DPR,dh=s.height/DPR;const face=amb.phase==="come"?-amb.dir:amb.dir;
  X.setTransform(DPR*(face<0?-1:1),0,0,DPR,amb.x*DPR,(amb.y-camY)*DPR);X.globalAlpha=amb.phase==="come"?.6+.4*Math.min(1,amb.t/(AMBUSH_ARRIVE_MS/1000)):.75;X.drawImage(s,-dw/2,-dh/2,dw,dh);X.globalAlpha=1;wT();
  if(amb.phase==="come"){const ex=Math.max(22,Math.min(W-22,amb.x)),ey=amb.y-amb.L*.35;X.font="900 40px system-ui,sans-serif";X.lineWidth=7;X.fillStyle="#ff2a2a";X.strokeText("!",ex,ey);X.fillText("!",ex,ey);X.font="900 22px system-ui,sans-serif";X.lineWidth=5}}
 wT();const L=shark.L,ks=L/sprC.L,max=sharkMax(shark.lvl),sr=shark.spd/max;
 if(shark.air){const k=Math.max(.25,1-shark.h/(H*.35));X.fillStyle="rgba(4,30,50,.35)";X.beginPath();X.ellipse(shark.x,SURF+4,L*.4*k,6*k,0,0,7);X.fill()}
 else{if(sr>.35){const c=Math.cos(shark.ang),sn=Math.sin(shark.ang),bx=shark.x-c*L*.55,by=shark.y-sn*L*.55,len=L*(.3+sr*.9);X.strokeStyle="rgba(235,252,255,"+(.2+sr*.4)+")";X.lineWidth=3;X.beginPath();
   for(const side of[-1,1]){X.moveTo(bx-sn*side*L*.08,by+c*side*L*.08);X.lineTo(bx-c*len-sn*side*len*.25,by-sn*len+c*side*len*.25)}X.stroke()}
  const pw=power(),ok=canLaunch();if(pw>.03){X.lineWidth=ok?5:3;X.strokeStyle=ok?"rgba(255,210,63,.95)":"rgba(235,252,255,.6)";X.beginPath();X.arc(shark.x,shark.y,L*.62,-Math.PI/2,-Math.PI/2+pw*6.283);X.stroke()}}
 const sq=shark.sq>0?Math.sin(shark.sq/.12*Math.PI):0,wob=shark.dead?0:Math.sin(shark.wag)*.04*(shark.air?0:1),flip=(Math.cos(shark.ang)<0?-1:1)*(shark.dead?Math.cos(Math.PI*Math.min(1,dead.t/.7)):1);
 X.setTransform(DPR,0,0,DPR,shark.x*DPR,(shark.y-camY)*DPR);X.rotate(shark.ang+wob);X.scale(ks*(1+sq*.15),ks*(1-sq*.18)*flip);
 const s=shark.chomp>0?sprO:sprC,dw=s.width/DPR,dh=s.height/DPR;X.globalAlpha=shark.safe>0&&shark.stun<=0&&Math.sin(t*20)<0?.45:1;X.drawImage(s,-dw/2-sprC.L*.05,-dh/2,dw,dh);X.globalAlpha=1;wT();
 if(shark.dead){const p=Math.min(1,dead.t/1.3);for(const q of dead.puffs){const e=Math.max(0,Math.min(1,(dead.t-q.dl)/1.2));if(e<=0||e>=1)continue;const r=L*(.18+.42*e)*q.k,x=shark.x+Math.cos(q.a)*L*q.d*(1+e),y=shark.y+Math.sin(q.a)*L*q.d*(1+e)-e*L*.15;X.globalAlpha=(1-e)*.8;X.drawImage(puffSpr,x-r,y-r,r*2,r*2)}X.globalAlpha=1}
 if(shark.stun>0){X.fillStyle="#ffe14d";X.strokeStyle=P.ink;X.lineWidth=2;for(let i=0;i<4;i++){const a=t*5+i*1.57,x=shark.x+Math.cos(a)*L*.35,y=shark.y-L*.32+Math.sin(a)*L*.08;X.beginPath();for(let j=0;j<10;j++){const r=j%2?3:8,b=j*.628;X.lineTo(x+Math.cos(b)*r,y+Math.sin(b)*r)}X.closePath();X.fill();X.stroke()}
  if(amb.on&&amb.phase==="come"){X.font="900 20px system-ui,sans-serif";X.lineWidth=5;X.strokeText("WIGGLE TO BREAK FREE!",W/2,shark.y+L*.6);X.fillStyle="#fff";X.fillText("WIGGLE TO BREAK FREE!",W/2,shark.y+L*.6)}}
 // darkness: the deeper, the smaller the circle of light around you
 const dk=Math.max(0,Math.min(1,(depthOf(shark.y)-.3)/.5));if(dk>0){X.setTransform(1,0,0,1,0,0);const R=(Math.max(W,H)*(1.6-dk*.75))*DPR,sx=shark.x*DPR,sy=(shark.y-camY)*DPR;X.globalAlpha=Math.min(.92,dk);
  X.drawImage(vigSpr,sx-R*2,sy-R*2,R*4,R*4);X.globalAlpha=1;
  // glowing fish shine through the dark
  X.setTransform(DPR,0,0,DPR,0,-camY*DPR);X.globalCompositeOperation="lighter";for(const f of fish)if(f.kind==="glow"&&f.y>top&&f.y<bot){const g=glowSpr[f.pal],sc=f.s/g.base,flip2=f.vx<0?-1:1;X.setTransform(DPR*flip2*sc,0,0,DPR*sc,f.x*DPR,(f.y-camY)*DPR);X.globalAlpha=.55+.25*Math.sin(t*3+f.ph);X.drawImage(g,-g.width/DPR/2,-g.height/DPR/2,g.width/DPR,g.height/DPR)}X.globalAlpha=1;X.globalCompositeOperation="source-over";wT()}
 // off-screen warnings (screen space)
 X.setTransform(DPR,0,0,DPR,0,0);for(const f of fish)if(f.st==="chase")edgeArrow(f.x,f.y,"#ff2a2a");for(const d of divers)if(Math.hypot(d.x-shark.x,d.y-shark.y)<H*.9)edgeArrow(d.x,d.y,"#ff9a1e");wT()}
function drawHud(){X.setTransform(DPR,0,0,DPR,0,0);const top=safeTop()+8,mw=Math.min(150,W*.36),mx=(W-mw)/2,my=top+12,fr=shark.lvl>=MAX_LEVEL?1:shark.meter/need(shark.lvl);
 X.fillStyle=P.ink;X.fillRect(mx-3,my-3,mw+6,22);X.fillStyle="#bfe9ff";X.fillRect(mx,my,mw,16);X.fillStyle="#7be04a";X.fillRect(mx,my,mw*fr,16);
 X.font="900 13px system-ui,sans-serif";X.fillStyle=P.ink;X.textAlign="center";X.textBaseline="top";X.fillText(shark.lvl>=MAX_LEVEL?"MAX SIZE":"SIZE "+(shark.lvl+1),W/2,my+1);
 X.font="900 32px system-ui,sans-serif";X.lineJoin="round";X.lineWidth=7;X.strokeStyle=P.ink;X.textAlign="left";X.strokeText("🐟"+score,12,top);X.fillStyle="#fff";X.fillText("🐟"+score,12,top);
 const tl=Math.ceil(timeLeft),ts=mode==="endless"?"⏱"+fmtT(elapsed):"⏱"+tl;X.textAlign="right";X.strokeText(ts,W-12,top);X.fillStyle=mode==="timed"&&tl<=10?"#ffd23f":"#fff";X.fillText(ts,W-12,top);
 if(mode==="timed"){const iy=top+48;for(let i=0;i<DIVER_CATCHES_TO_LOSE;i++){const x=W-22-i*26;X.lineWidth=2;X.strokeStyle=P.ink;X.fillStyle=i<netHits?"#e2463c":"rgba(255,255,255,.35)";X.beginPath();X.arc(x,iy,9,0,7);X.fill();X.stroke();X.lineWidth=1;X.beginPath();X.moveTo(x-6,iy-3);X.lineTo(x+6,iy-3);X.moveTo(x-6,iy+3);X.lineTo(x+6,iy+3);X.moveTo(x-3,iy-7);X.lineTo(x-3,iy+7);X.moveTo(x+3,iy-7);X.lineTo(x+3,iy+7);X.stroke()}}// net-hit icons
 if(bannerT>0){X.globalAlpha=Math.min(1,bannerT*3);X.textAlign="center";X.font="900 54px system-ui,sans-serif";X.lineWidth=9;X.strokeText("Divers!",W/2,H*.32);X.fillStyle="#ff9a1e";X.fillText("Divers!",W/2,H*.32);X.globalAlpha=1}
 if(fasterT>0){X.globalAlpha=Math.min(1,fasterT*2);X.textAlign="center";X.font="900 26px system-ui,sans-serif";X.lineWidth=7;const y=H*.84;X.strokeText("Divers are faster!",W/2,y);X.fillStyle="#ff9a1e";X.fillText("Divers are faster!",W/2,y);X.globalAlpha=1}
 if(diverTipT>0){X.globalAlpha=Math.min(1,diverTipT);X.textAlign="center";X.font="800 18px system-ui,sans-serif";X.lineWidth=6;const y=H*.5;X.strokeText("Nets stun you.",W/2,y);X.strokeText("Big sharks love a stunned shark!",W/2,y+23);X.fillStyle="#fff";X.fillText("Nets stun you.",W/2,y);X.fillText("Big sharks love a stunned shark!",W/2,y+23);X.globalAlpha=1}
 if(hintT>0){X.globalAlpha=Math.min(1,hintT);X.textAlign="center";X.font="800 19px system-ui,sans-serif";X.lineWidth=6;const y=H*.62;X.strokeText("Swim down to build speed,",W/2,y);X.strokeText("then swim up fast to leap!",W/2,y+24);X.fillStyle="#fff";X.fillText("Swim down to build speed,",W/2,y);X.fillText("then swim up fast to leap!",W/2,y+24);X.globalAlpha=1}
 {const d=depthOf(shark.y),mx2=W-16,y0=top+80,y1=H-14,hh=y1-y0;X.lineWidth=3;X.strokeStyle=P.ink;for(let i=0;i<ZONES.length;i++){const a=ZONES[i].d,b2=i+1<ZONES.length?ZONES[i+1].d:1;X.fillStyle=ZONES[i].col;X.fillRect(mx2-6,y0+a*hh,12,(b2-a)*hh)}X.strokeRect(mx2-6,y0,12,hh);
  const my2=y0+Math.max(0,Math.min(1,d))*hh;X.fillStyle="#fff";X.beginPath();X.moveTo(mx2-8,my2);X.lineTo(mx2-20,my2-7);X.lineTo(mx2-20,my2+7);X.closePath();X.fill();X.stroke();
  const m=Math.max(0,Math.round((shark.y-SURF)/H*60)),z=ZONES.filter(q=>q.d<=d+1e-9).pop();X.font="800 13px system-ui,sans-serif";X.textAlign="right";X.textBaseline="middle";X.lineWidth=4;const lab=(z?z.name:"")+" "+m+" m";X.strokeText(lab,mx2-24,my2);X.fillStyle="#fff";X.fillText(lab,mx2-24,my2)}
 X.textAlign="left"}
function endRound(){state="over";shark.air=false;shake=0;C.style.transform="";const eaten=endReason==="eaten",caught=endReason==="caught";shark.stun=0;amb.on=false;$("reason").textContent=eaten?"Gulp!":caught?"Caught!":"Time's up!";$("reason").className=eaten?"gulp":caught?"caught":"";
 const bk=bestKey();best=+(localStorage.getItem(bk)||0);if(score>best){best=score;localStorage.setItem(bk,String(best))}$("final").textContent=score;$("bestTxt").textContent=(score>=best&&score>0?"🏆 New best! ":"Best: ")+best+(mode==="endless"?" (Endless)":" (Timed)");
 $("stats").textContent=mode==="endless"?`Surfers eaten: ${surfersCaught} · Survived ${fmtT(elapsed)}`:`Surfers eaten: ${surfersCaught}`;
 $("roundNote").textContent=mode==="endless"?"Endless: ends only when you get eaten.":`Round length: ${roundLen} seconds.`;if(eaten)SFX.gulp();else if(caught)SFX.caught();else SFX.end();phStop();chipStop();chip.want=false;show("overUi")}

// ---------- shared draw ----------
function drawWater(t){const sy=Math.max(0,Math.min(bgSpr.height-C.height,Math.round(camY*DPR)));X.setTransform(1,0,0,1,0,0);X.drawImage(bgSpr,0,sy,C.width,C.height,0,0,C.width,C.height);
 X.setTransform(DPR,0,0,DPR,0,-camY*DPR);const view0=camY,view1=camY+H;
 // floating particles: fewer when the screen is busy
 const d0=depthOf(camY+H/2),n=busy?14:snow.length;X.fillStyle=d0<.3?"rgba(230,250,255,.35)":"rgba(200,210,230,.35)";for(let i=0;i<n;i++){const p=snow[i],x=p.x*W,y=camY+(((p.y*H-t*p.sp*(d0<.3?-1:1)-camY*.5)%H)+H)%H,r=p.r*(d0<.3?1.6:1);X.fillRect(x-r,y-r,r*2,r*2)}
 if(view1>BED-60){X.globalCompositeOperation="lighter";for(const vx of floorSpr.vents){X.globalAlpha=.55+.35*Math.sin(t*2.2+vx);X.drawImage(ventSpr,vx-90,BED-150,180,180)}X.globalAlpha=1;X.globalCompositeOperation="source-over";
  if(!busy){X.fillStyle="rgba(255,150,60,.5)";for(const vx of floorSpr.vents)for(let i=0;i<3;i++){const ph=(t*.5+i/3+vx*.01)%1;X.beginPath();X.arc(vx+Math.sin(ph*9+i)*8,BED-60-ph*200,3+ph*3,0,7);X.fill()}}}
 if(SURF>view0-10&&SURF<view1+10){X.strokeStyle="rgba(220,248,255,.5)";X.lineWidth=3;X.lineCap="round";X.beginPath();const wn=busy?Math.ceil(waves.length/2):waves.length;for(let i=0;i<wn;i++){const w=waves[i],x=((w.x+t*w.sp)%1)*(W+80)-40,y=SURF+20+w.y*H*.5+Math.sin(t+w.x*9)*6;X.moveTo(x,y);X.quadraticCurveTo(x+w.w*.5,y-6,x+w.w,y)}X.stroke();
  X.strokeStyle="#e8fbff";X.lineWidth=4;X.beginPath();for(let x=0;x<=W;x+=busy?46:24){const y=SURF+Math.sin(t*2+x*.05)*2.5;x?X.lineTo(x,y):X.moveTo(x,y)}X.stroke()}}
function drawFx(dt,screen){X.setTransform(DPR,0,0,DPR,0,screen?0:-camY*DPR);X.fillStyle="#e8fbff";X.strokeStyle=P.ink;X.lineWidth=1.5;for(const p of parts)if(p.t>0){const r=3+p.t*8;X.beginPath();X.arc(p.x,p.y,r,0,7);X.fill();X.stroke()}
 X.textAlign="center";X.textBaseline="middle";X.lineJoin="round";for(const p of pops)if(p.t>0){p.t-=dt*1.1;p.y-=dt*40;X.globalAlpha=Math.min(1,p.t*2);X.font="900 24px system-ui,sans-serif";X.lineWidth=6;X.strokeStyle=P.ink;X.strokeText(p.txt,p.x,p.y);X.fillStyle=P.yel;X.fillText(p.txt,p.x,p.y)}X.globalAlpha=1;X.textAlign="left"}

// ---------- loop ----------
let last=0,raf=0,fpsT=0,fpsN=0,fps=0;const perf={frames:0,js:0,dtSum:0,reset(){this.frames=0;this.js=0;this.dtSum=0}};
const PORTRAIT_MQ=matchMedia("(orientation: portrait)"),NO_ROT=/[?&]portrait/.test(location.search);fsRot=PORTRAIT_MQ.matches&&!NO_ROT;PORTRAIT_MQ.addEventListener("change",()=>{fsRot=PORTRAIT_MQ.matches&&!NO_ROT});
function frame(now){raf=requestAnimationFrame(frame);let dt=(now-last)/1000;if(state!=="play"&&state!=="dead"&&dt<1/31)return;// menus: ~30 fps
 last=now;if(dt>.1)dt=.1;const t0=performance.now(),t=now/1000;
 if(state==="play"&&!fsRot)updPlay(dt);else if(state==="dead")updDead(dt);else if(state==="title")updTitle(dt);
 drawWater(t);if(state==="play"||state==="over"||state==="dead"){if(shake>0){C.style.transform=`translate(${(Math.random()-.5)*6}px,${(Math.random()-.5)*6}px)`;C._sh=1}else if(C._sh){C.style.transform="";C._sh=0}drawPlay(t);drawFx(dt);drawHud()}
 else{X.setTransform(DPR,0,0,DPR,0,0);if(state==="title"||state==="credits")drawTitle(t);drawFx(dt,true)}
 if(SHOW_FPS){fpsN++;fpsT+=dt;if(fpsT>.5){fps=Math.round(fpsN/fpsT);fpsN=0;fpsT=0}X.setTransform(DPR,0,0,DPR,0,0);X.font="bold 14px monospace";X.fillStyle="#fff";X.textAlign="left";X.fillText(fps+" fps",8,H-14)}
 perf.frames++;perf.dtSum+=dt;perf.js+=performance.now()-t0}
function startLoop(){if(!raf){last=performance.now();raf=requestAnimationFrame(frame)}}
function stopLoop(){cancelAnimationFrame(raf);raf=0}
document.addEventListener("visibilitychange",()=>{if(document.hidden){stopLoop();if(music.cur)music.cur.pause();if(AC)AC.suspend()}else{startLoop();if(AC)AC.resume();if(music.cur&&soundOn)music.cur.play().catch(()=>{})}});

// ---------- UI ----------
function hideAll(){for(const id of["titleUi","overUi","credUi","pickUi","tap"])$(id).classList.add("hide")}
function show(id){hideAll();$(id).classList.remove("hide")}
// steering: the finger's slide direction is the swim direction; sliding distance builds drive (speed)
C.addEventListener("pointerdown",e=>{if(state!=="play")return;e.preventDefault();initAudio();touch.on=true;touch.x=e.clientX;touch.y=e.clientY;touch.dir=shark.ang;touch.sx=Math.cos(shark.ang);touch.sy=Math.sin(shark.ang);touch.lastMove=performance.now();try{C.setPointerCapture(e.pointerId)}catch(_){}});
C.addEventListener("pointermove",e=>{if(!touch.on)return;const dx=e.clientX-touch.x,dy=e.clientY-touch.y,d=Math.hypot(dx,dy);if(d<3)return;
 if(shark.stun>0){touch.x=e.clientX;touch.y=e.clientY;struggle(d);return}
 touch.sx=touch.sx*.55+dx/d*.45;touch.sy=touch.sy*.55+dy/d*.45;touch.dir=Math.atan2(touch.sy,touch.sx);touch.drive=Math.min(1,touch.drive+d/(W*STEER.DRIVE_PX));touch.lastMove=performance.now();touch.x=e.clientX;touch.y=e.clientY});
const up=()=>{touch.on=false};C.addEventListener("pointerup",up);C.addEventListener("pointercancel",up);
document.addEventListener("touchmove",e=>e.preventDefault(),{passive:false});document.addEventListener("gesturestart",e=>e.preventDefault());document.addEventListener("contextmenu",e=>e.preventDefault());// no long-press menu
document.addEventListener("pointerdown",()=>{if(AC&&AC.state==="suspended")AC.resume().catch(()=>{})},true);
function buildPick(){const box=$("pickList");box.innerHTML="";for(const k of Object.keys(TYPES)){const t=TYPES[k],b=document.createElement("button");b.className="pick"+(k===sType?" sel":"");b.dataset.type=k;
  const cv=render3DShark(110*2,false,t);cv.style.width="110px";cv.className="pv";b.appendChild(cv);
  const info=document.createElement("div");info.className="pinfo";info.innerHTML=`<b>${t.name}</b><span class="pdesc">${t.desc}</span>`+Object.entries(t.bars).map(([n,v])=>`<span class="bar" data-stat="${n}" data-v="${v}"><i>${n}</i><em style="width:${v*20}%"></em></span>`).join("");b.appendChild(info);
  b.onclick=()=>{sType=k;localStorage.setItem(TYPE_KEY,k);buildSprites();startGame()};box.appendChild(b)}}
$("tap").addEventListener("pointerdown",()=>{initAudio();startTitle();playMusic("title")});
$("start").onclick=()=>{initAudio();state="pick";buildPick();show("pickUi")};
for(const k of MODES)$("mode_"+k).onclick=()=>setMode(k);setMode(mode);
$("pickBack").onclick=()=>{state="title";show("titleUi")};
$("again").onclick=()=>startGame();
$("home").onclick=()=>{buildSprites();startTitle();playMusic("title")};
$("snd").onclick=()=>setSound(!soundOn);
function setCalm(v){calm=v;localStorage.setItem(CALM_KEY,v?"1":"0");$("calm").textContent=v?"🌙 Calm (no shake)":"🌊 Shake on"}setCalm(calm);$("calm").onclick=()=>setCalm(!calm);
$("cred").onclick=()=>{state="credits";show("credUi")};
$("credBack").onclick=()=>{state="title";show("titleUi")};
window.addEventListener("resize",resize);
setSound(soundOn);resize();show("tap");startLoop();
// build id + "Updated!" note (shown once, 2 s, on the first launch of a new build). Update checks are done by the service worker.
const BUILD=(document.querySelector('meta[name="build"]')||{}).content||"",BUILD_KEY="saTEST_build";
{const prev=localStorage.getItem(BUILD_KEY);if(BUILD&&prev&&prev!==BUILD){$("upd").classList.remove("hide");setTimeout(()=>$("upd").classList.add("hide"),2000)}if(BUILD)localStorage.setItem(BUILD_KEY,BUILD)}
if("serviceWorker" in navigator&&location.protocol!=="file:"){navigator.serviceWorker.register("sw.js").then(()=>navigator.serviceWorker.ready).then(r=>{if(navigator.onLine&&r.active)r.active.postMessage("check")}).catch(()=>{})}

// ---------- test hooks ----------
window.__sa={get state(){return state},shark,fish,surf,touch,perf,sfxCount,TYPES,TIERS,LAUNCH,BEAT,STEER,FAST_SFX,SURFERS,MAX_LEVEL,ROUND_SECONDS,
 get score(){return score},get timeLeft(){return timeLeft},set timeLeft(v){timeLeft=v},get best(){return best},get endReason(){return endReason},get soundOn(){return soundOn},get chip(){return !!chip.buf},get chipPlaying(){return !!chip.src},get chipFailed(){return chip.failed},get acState(){return AC?AC.state:"none"},get looping(){return !!raf},MUSIC_VOL,get placeholder(){return !!placeholder},
 get type(){return sType},get camY(){return camY},get WORLD_H(){return WORLD_H},get sizeK(){return sizeK},WORLD,ZONES,GROW,CREATURES,depthOf,ptsOf,growOf,bite,spawnFish,setCreature,get titleT(){return T.t},get titleShark(){return T.sr},get titleRect(){return titleRect()},get rotPaused(){return fsRot},BUILD,set god(v){godMode=!!v},get SURF(){return SURF},get BED(){return BED},trait,maxSpeed:()=>sharkMax(shark.lvl),power,canLaunch,rel,feed,need,beatNow,beatLen,setRound(s){window.__saRound=s},
 clearFood(){for(const f of fish){f.x=-999;f.vx=0;f.vy=0}for(const s of surf)s.zip=999},
 placeFishAtMouth(ti){const f=fish[0];setCreature(f,TIERS[ti||0].s,"fish");f.vy=0;const [mx,my]=mouth();f.x=mx;f.y=my;f.vx=0;return fish.indexOf(f)},
 placeFishAt(ti,x,y,vx){const f=fish.find(q=>!q.used)||fish[0];setCreature(f,TIERS[ti].s,"fish");f.x=x;f.y=y;f.vx=vx||0;f.vy=0;return fish.indexOf(f)},
 placeSurfer(i,x,k){const s=surf[i];s.zip=0;s.x=x;s.vx=0;if(k!=null)s.k=k},divers,amb,get netHits(){return netHits},get surfersCaught(){return surfersCaught},get struggles(){return struggles},get ambCool(){return ambCool},set ambCool(v){ambCool=v},get bannerT(){return bannerT},
 DIV:{DIVER_TRIGGER_SURFERS,DIVER_SPEED_FRACTION,DIVER_DETECT_RANGE,DIVER_GIVEUP_MS,DIVER_GRACE_MS,DIVER_COOLDOWN_MS,DIVER_SAFE_AFTER_STUN_MS,DIVER_NET_REACH,DIVER_CATCHES_TO_LOSE,DIVER_MAX,STUN_MS,AMBUSH_STUN_MS,AMBUSH_ON_HIT,AMBUSH_CHANCE,AMBUSH_ARRIVE_MS,AMBUSH_COOLDOWN_MS,STRUGGLE_SHORTEN_MS,STRUGGLE_PX,AMBUSHER_SIZE,AMBUSHER_LEAVE_MS},
 render3DShark,sim(sec,bot,step){step=step||1/60;const n=Math.round(sec/step);let i=0;for(;i<n&&state==="play";i++){if(bot)bot(step);updPlay(step)}return i*step},startAs(t,m){sType=t;if(m)setMode(m);startGame()},setMode,get mode(){return mode},get fasterT(){return fasterT},get elapsed(){return elapsed},MODE:{MODES,DIVER_SPEEDUP_PER_SURFER,DIVER_SPEED_CAP,DIVER_SPEEDUP_HINT_EVERY},surferCaught,spawnDiver,diverSpeed,netHit,struggle,setAmbushForce(v){window.__saAmbushForce=v},
 setLevel(l){shark.lvl=l;shark.meter=0;buildShark();shark.Lt=shark.L;setWorldK(1/trueGrow(l))},get worldK(){return worldK},trueGrow,get dead(){return dead}};
