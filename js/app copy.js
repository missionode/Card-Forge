// =========================
// Card Forge — Vanilla JS
// =========================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const CANVAS_W = 1011; // px @300DPI 85.6mm
const CANVAS_H = 638;  // px @300DPI 54mm
const BLEED = Math.round(0.1181 * 300); // 3mm ≈ 0.1181 in; at 300dpi → ~35px
const SAFE = 24; // safe margin in from trim (visual guide only)

// --- Elements
const canvFront = $("#front");
const canvBack  = $("#back");
canvFront.width = CANVAS_W; canvFront.height = CANVAS_H;
canvBack.width  = CANVAS_W; canvBack.height  = CANVAS_H;

const ctxF = canvFront.getContext("2d");
const ctxB = canvBack.getContext("2d");

// --- State (with defaults)
const state = {
  brandName: "THE BRAND NAME",
  brandTag: "PRIME MEMBERSHIP CARD",
  primaryColor: "#0f172a",
  accentColor: "#38bdf8",
  phone: "+91 9544319000",
  website: "www.brandname.in",
  address: "TC 30/104 (1) Kamaleswaram, Manacaud PO - 695009",
  legal: "• This card is not a credit card\n• This card can't be transferred or redeemed for cash or re-sale\n• The company is not responsible if the card is lost, stolen or damaged\n• This card is subject to company regulations",
  bgMode: "pattern",
  pattern: "rings",
  solidBg: "#111827",
  bgUpload: null, // dataURL
  idPrefix: "MH",
  startNum: 1,
  logoFull: "./assets/logo-full.svg",
  logoMark: "./assets/logo-mark.svg",
  memberName: "Member Name",
  memberId: "",
};

// --- Persistence
const PREFS_KEY = "cardforge_prefs_v1";

function savePrefs() {
  const payload = { ...state };
  localStorage.setItem(PREFS_KEY, JSON.stringify(payload));
}

function loadPrefs() {
  const s = localStorage.getItem(PREFS_KEY);
  if (!s) return false;
  const parsed = JSON.parse(s);
  Object.assign(state, parsed);
  hydrateFormFromState();
  renderAll();
  return true;
}
function clearPrefs() {
  localStorage.removeItem(PREFS_KEY);
}

// --- Helpers
function loadImage(src) {
  return new Promise((resolve,reject)=>{
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function toDataURL(file) {
  return new Promise((resolve,reject)=>{
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

function hexToRGBA(hex, a=1){
  const v = hex.replace('#','');
  const num = parseInt(v,16);
  const r = (v.length===3) ? (num>>8 & 0xF)*17 : (num>>16)&255;
  const g = (v.length===3) ? (num>>4 & 0xF)*17 : (num>>8)&255;
  const b = (v.length===3) ? (num & 0xF)*17 : num&255;
  return `rgba(${r},${g},${b},${a})`;
}

function drawPattern(ctx, mode, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(0,0,CANVAS_W,CANVAS_H);

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#000";

  const step = 20;
  if (mode === "grid") {
    for (let x=0;x<CANVAS_W;x+=step) {
      ctx.fillRect(x,0,1,CANVAS_H);
    }
    for (let y=0;y<CANVAS_H;y+=step) {
      ctx.fillRect(0,y,CANVAS_W,1);
    }
  } else if (mode === "dots") {
    for (let y=0;y<CANVAS_H;y+=step) {
      for (let x=0;x<CANVAS_W;x+=step) {
        ctx.beginPath(); ctx.arc(x,y,1.6,0,Math.PI*2); ctx.fill();
      }
    }
  } else if (mode === "wave") {
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = "#000"; ctx.lineWidth=2;
    for (let y=0;y<CANVAS_H;y+=18) {
      ctx.beginPath();
      for (let x=0;x<=CANVAS_W;x+=18) {
        const amp = 6;
        const yy = y + Math.sin(x/28)*amp;
        if (x===0) ctx.moveTo(0,yy); else ctx.lineTo(x,yy);
      }
      ctx.stroke();
    }
  } else { // rings
    for (let y=0;y<CANVAS_H;y+=step) {
      for (let x=0;x<CANVAS_W;x+=step) {
        ctx.beginPath(); ctx.arc(x+10,y+10,7,0,Math.PI*2); ctx.strokeStyle="rgba(0,0,0,0.16)"; ctx.lineWidth=1; ctx.stroke();
      }
    }
  }
  ctx.restore();
}

async function drawBackground(ctx) {
  const { bgMode, pattern, solidBg, bgUpload, primaryColor } = state;
  if (bgMode === "solid") {
    ctx.fillStyle = solidBg; ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
  } else if (bgMode === "upload" && bgUpload) {
    const img = await loadImage(bgUpload);
    // cover
    const ratio = Math.max(CANVAS_W/img.width, CANVAS_H/img.height);
    const w = img.width*ratio, h = img.height*ratio;
    const x = (CANVAS_W - w)/2, y = (CANVAS_H - h)/2;
    ctx.drawImage(img,x,y,w,h);
    // tint for brand cohesion
    ctx.fillStyle = hexToRGBA(primaryColor,0.25);
    ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
  } else {
    drawPattern(ctx, pattern, state.solidBg);
  }
}

// Text helpers
function titleCase(s){
  return s.replace(/\w\S*/g, t=> t[0].toUpperCase()+t.slice(1).toLowerCase());
}

// Safe area rect for guides
function drawGuides(ctx){
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth=1;
  ctx.strokeRect(BLEED, BLEED, CANVAS_W-BLEED*2, CANVAS_H-BLEED*2);
  ctx.restore();
}

// Draw Logo (tint SVG by drawing as is, assuming theme already cohesive)
async function drawLogo(ctx, src, x, y, w, h){
  try{
    const img = await loadImage(src);
    ctx.drawImage(img,x,y,w,h);
  }catch(e){}
}

// Barcode to canvas -> draw
async function drawBarcodeTo(ctx, value, x, y, w, h, color="#000"){
  const tmp = document.createElement("canvas");
  JsBarcode(tmp, value, {format:"CODE128", displayValue:false, margin:0, background:"#ffffff", lineColor:"#000", height: h, width: 2});
  const ratio = w/tmp.width;
  ctx.save();
  ctx.filter = "contrast(140%)";
  ctx.drawImage(tmp, x, y, tmp.width*ratio, h);
  ctx.restore();
}

// --- Rendering: FRONT
async function renderFront() {
  const c = ctxF;
  c.clearRect(0,0,CANVAS_W,CANVAS_H);
  await drawBackground(c);

  // brand strip / gradient
  const grad = c.createLinearGradient(0,0,CANVAS_W, CANVAS_H);
  grad.addColorStop(0, hexToRGBA(state.primaryColor,0.45));
  grad.addColorStop(1, "transparent");
  c.fillStyle = grad; c.fillRect(0,0,CANVAS_W,CANVAS_H);

  // Logo (mark) top-right
  await drawLogo(c, state.logoMark, CANVAS_W - BLEED - 120, BLEED, 100, 100);

  // Brand name
  c.fillStyle = "#fff";
  c.font = "700 58px Poppins, sans-serif";
  c.textBaseline = "top";
  c.fillText(titleCase(state.brandName), BLEED+24, BLEED+28);

  // Tagline
  c.font = "600 34px Poppins, sans-serif";
  c.fillStyle = hexToRGBA("#ffffff",0.9);
  c.fillText(state.brandTag.toUpperCase(), BLEED+24, BLEED+28+70);

  // Member name badge
  const badgeY = CANVAS_H - BLEED - 120;
  c.fillStyle = hexToRGBA("#000000",0.25);
  c.roundRect(BLEED+24, badgeY, 600, 88, 16); c.fill();
  c.fillStyle = "#fff";
  c.font = "600 40px Inter, sans-serif";
  c.fillText(titleCase(state.memberName || "Member Name"), BLEED+48, badgeY+24);

  // Watermark big logo-full faint
  try{
    const img = await loadImage(state.logoFull);
    const w=320, h= (img.height/img.width)*w;
    c.globalAlpha = 0.08;
    c.drawImage(img, CANVAS_W - w - 60, CANVAS_H - h - 40, w, h);
    c.globalAlpha = 1;
  }catch(e){}

  // Guides
  drawGuides(c);
}

// --- Rendering: BACK
async function renderBack() {
  const c = ctxB;
  c.clearRect(0,0,CANVAS_W,CANVAS_H);
  await drawBackground(c);

  // Info panel
  c.fillStyle = hexToRGBA("#000000",0.35);
  c.roundRect(BLEED, CANVAS_H-150-BLEED, CANVAS_W-BLEED*2, 150, 14); c.fill();

  // Left legal text
  c.fillStyle = "#fff";
  c.font = "600 20px Inter, sans-serif";
  c.fillText("Baking You Happy", BLEED+24, BLEED+24);

  c.font = "400 18px Inter, sans-serif";
  const legalLines = (state.legal||"").split("\n");
  let ly = BLEED+60;
  legalLines.forEach(line=>{
    wrapText(c, line, BLEED+24, ly, 520, 22);
    ly += 26;
  });

  // Barcode + ID bottom-left
  const id = (state.memberId && state.memberId.trim()) || autoIdPreview();
  await drawBarcodeTo(c, id, BLEED+24, CANVAS_H-140, 420, 68, "#fff");
  c.fillStyle = "#fff"; c.font="500 20px Inter, sans-serif";
  c.fillText(id, BLEED+24, CANVAS_H-60);

  // Right contact block
  const bx = CANVAS_W - BLEED - 420;
  c.fillStyle = hexToRGBA("#000000",0.28);
  c.roundRect(bx, BLEED+24, 420, 170, 14); c.fill();

  // brand mark small
  await drawLogo(c, state.logoMark, bx+20, BLEED+36, 60, 60);

  c.fillStyle="#fff";
  c.font="700 20px Poppins, sans-serif";
  c.fillText(titleCase(state.brandName), bx+90, BLEED+48);
  c.font="500 18px Inter, sans-serif";
  c.fillText(`Ph: ${state.phone||""}`, bx+90, BLEED+80);
  c.fillText(`${state.website||""}`, bx+90, BLEED+108);

  // address
  c.font="400 16px Inter, sans-serif";
  const addrLines = (state.address||"").split("\n");
  let ay = BLEED+140;
  addrLines.forEach(line=>{
    c.fillText(line, bx+20, ay);
    ay += 22;
  });

  drawGuides(c);
}

// text wrapper
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

// --- Export helpers
function downloadCanvasPNG(canvas, filename){
  canvas.toBlob(b=> saveAs(b, filename), "image/png");
}

function pad(num, size){ let s=String(num); while (s.length<size) s="0"+s; return s; }

function autoIdPreview(){
  return `${state.idPrefix}${pad(state.startNum,6)}`;
}

function makeIdFromSequence(idx) {
  return `${state.idPrefix}${pad(state.startNum + idx, 6)}`;
}

// --- Form wiring
function hydrateFormFromState(){
  $("#brandName").value = state.brandName;
  $("#brandTag").value = state.brandTag;
  $("#primaryColor").value = state.primaryColor;
  $("#accentColor").value = state.accentColor;
  $("#phone").value = state.phone;
  $("#website").value = state.website;
  $("#address").value = state.address;
  $("#legal").value = state.legal;
  $("#solidBg").value = state.solidBg;
  $("#idPrefix").value = state.idPrefix;
  $("#startNum").value = state.startNum;
  $("#memberName").value = state.memberName;
  $("#memberId").value = state.memberId;

  $$("input[name=bgMode]").forEach(r=> r.checked = (r.value===state.bgMode));

  // set app mark
  $("#appMark").src = state.logoMark || "./assets/logo-mark.svg";
}

function wireInputs(){
  const bind = (id, key, transform = v=>v) => {
    $(id).addEventListener("input", e=>{
      state[key] = transform(e.target.value);
      renderAll();
    });
  };
  bind("#brandName", "brandName");
  bind("#brandTag", "brandTag");
  bind("#primaryColor", "primaryColor");
  bind("#accentColor", "accentColor");
  bind("#phone", "phone");
  bind("#website", "website");
  $("#address").addEventListener("input", e=>{ state.address = e.target.value; renderAll(); });
  $("#legal").addEventListener("input", e=>{ state.legal = e.target.value; renderAll(); });
  bind("#solidBg", "solidBg");
  bind("#idPrefix", "idPrefix");
  bind("#startNum", "startNum", v=>parseInt(v||"1",10));
  bind("#memberName", "memberName");
  bind("#memberId", "memberId");

  $$("input[name=bgMode]").forEach(r=>{
    r.addEventListener("change", e=>{ state.bgMode = e.target.value; renderAll(); });
  });

  // pattern buttons
  $$("#patternPicker [data-pattern]").forEach(b=>{
    b.addEventListener("click", ()=>{
      state.pattern = b.getAttribute("data-pattern");
      state.bgMode = "pattern";
      $$("input[name=bgMode]").forEach(r=> r.checked = (r.value==="pattern"));
      renderAll();
    });
  });

  // uploads
  $("#bgUpload").addEventListener("change", async (e)=>{
    const f = e.target.files[0]; if(!f) return;
    state.bgUpload = await toDataURL(f);
    state.bgMode = "upload";
    $$("input[name=bgMode]").forEach(r=> r.checked = (r.value==="upload"));
    renderAll();
  });

  $("#logoFull").addEventListener("change", async (e)=>{
    const f = e.target.files[0]; if(!f) return;
    state.logoFull = await toDataURL(f);
    renderAll();
  });

  $("#logoMark").addEventListener("change", async (e)=>{
    const f = e.target.files[0]; if(!f) return;
    state.logoMark = await toDataURL(f);
    $("#appMark").src = state.logoMark;
    renderAll();
  });

  // prefs
  $("#savePrefs").addEventListener("click", ()=>{ savePrefs(); alert("Preferences saved.");});
  $("#loadPrefs").addEventListener("click", ()=>{ if(!loadPrefs()) alert("No saved preferences found.");});
  $("#clearPrefs").addEventListener("click", ()=>{ clearPrefs(); alert("Preferences cleared.");});

  // dark
  $("#btnDark").addEventListener("click", ()=>{
    document.documentElement.classList.toggle("dark");
  });

  // downloads
  $("#dlFront").addEventListener("click", ()=> downloadCanvasPNG(canvFront, `${(state.memberId||autoIdPreview())}_front.png`));
  $("#dlBack").addEventListener("click",  ()=> downloadCanvasPNG(canvBack,  `${(state.memberId||autoIdPreview())}_back.png`));

  // bulk
  $("#bulkGo").addEventListener("click", doBulk);
}

async function renderAll(){
  await renderFront();
  await renderBack();
}

// --- Bulk processing
async function doBulk(){
  const file = $("#csvFile").files[0];
  const status = $("#bulkStatus");
  if (!file) { status.textContent = "Please choose a CSV file."; return; }

  status.textContent = "Parsing CSV…";
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: async (res)=>{
      const rows = res.data;
      if (!rows.length) { status.textContent = "No rows found."; return; }

      const zip = new JSZip();
      let seqIdx = 0;

      status.textContent = `Rendering ${rows.length} cards…`;
      for (let i=0;i<rows.length;i++){
        const r = rows[i];
        const name = (r.name||"").trim();
        if (!name) continue;

        const id = (r.member_id && r.member_id.trim()) || makeIdFromSequence(seqIdx++);
        // mutate state with per-user fields
        const oldName = state.memberName, oldId = state.memberId;
        state.memberName = name; state.memberId = id;

        await renderAll(); // draw both canvases

        // collect as blobs
        const frontBlob = await new Promise(res=> canvFront.toBlob(res, "image/png"));
        const backBlob  = await new Promise(res=> canvBack.toBlob(res, "image/png"));

        zip.file(`${id}_front.png`, frontBlob);
        zip.file(`${id}_back.png`, backBlob);
      }

      // restore
      state.memberName = $("#memberName").value;
      state.memberId = $("#memberId").value;
      await renderAll();

      status.textContent = "Packaging ZIP…";
      const content = await zip.generateAsync({type:"blob"});
      saveAs(content, "cards.zip");
      status.textContent = "Done. ZIP downloaded.";
    }
  });
}

// --- Canvas roundRect polyfill for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x+r, y);
    this.arcTo(x+w, y,   x+w, y+h, r);
    this.arcTo(x+w, y+h, x,   y+h, r);
    this.arcTo(x,   y+h, x,   y,   r);
    this.arcTo(x,   y,   x+w, y,   r);
    this.closePath();
    return this;
  }
}

// --- Init
(function init(){
  hydrateFormFromState();
  wireInputs();
  renderAll();
})();
