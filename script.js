// DOM refs
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const captureBtn = document.getElementById("capture-btn");
const autoCapBtn = document.getElementById("auto-capture-btn");
const sampleBox = document.getElementById("sample-color");
const hRange = document.getElementById("h-range");
const sMin = document.getElementById("s-min");
const vMin = document.getElementById("v-min");
const previewMaskChk = document.getElementById("preview-mask");
const logEl = document.getElementById("log");

// Display values
document.getElementById("h-range-val").textContent = hRange.value;
document.getElementById("s-min-val").textContent = sMin.value;
document.getElementById("v-min-val").textContent = vMin.value;

// Variables
let background = null;
let sampledHSV = null;

const width = 640, height = 480;
canvas.width = width;
canvas.height = height;

// Update labels
hRange.oninput = () => document.getElementById("h-range-val").textContent = hRange.value;
sMin.oninput = () => document.getElementById("s-min-val").textContent = sMin.value;
vMin.oninput = () => document.getElementById("v-min-val").textContent = vMin.value;

// log helper
function log(msg){ logEl.textContent = msg; }

// Start webcam
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => { video.srcObject = stream; log("Camera started."); });

// rgb → hsv
function rgbToHsv(r,g,b){
  r/=255; g/=255; b/=255;
  let max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h=0, s, v=max;
  let d = max - min;
  s = max===0?0:d/max;

  if(max!==min){
    if(max===r){ h=(g-b)/d + (g<b?6:0); }
    else if(max===g){ h=(b-r)/d + 2; }
    else{ h=(r-g)/d + 4; }
    h *= 60;
  }
  return [h, s*100, v*100];
}

// Capture background
captureBtn.onclick = ()=>{
  log("Capturing background...");
  setTimeout(()=>{
    ctx.drawImage(video,0,0,width,height);
    background = ctx.getImageData(0,0,width,height);
    log("Background captured!");
  },300);
};

// Auto capture 3 sec
autoCapBtn.onclick = ()=>{
  let t=3;
  const interval=setInterval(()=>{
    log(`Auto capture in ${t}...`);
    t--;
    if(t<0){
      clearInterval(interval);
      captureBtn.click();
    }
  },1000);
};

// Sample color on click
canvas.onclick = (e)=>{
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
  const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));
  const frame = ctx.getImageData(0,0,width,height);
  const i = (y*width + x)*4;

  const r = frame.data[i], g = frame.data[i+1], b = frame.data[i+2];
  sampledHSV = rgbToHsv(r,g,b);

  sampleBox.style.background = `rgb(${r},${g},${b})`;
  log(`Sampled HSV: ${sampledHSV.map(v=>v.toFixed(1)).join(" | ")}`);
};

// Smoothing 3x3 mask
function smoothMask(mask,w,h){
  const out = new Uint8ClampedArray(mask.length);
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      let sum=0,count=0;
      for(let dy=-1;dy<=1;dy++){
        for(let dx=-1;dx<=1;dx++){
          const nx=x+dx, ny=y+dy;
          if(nx>=0 && nx<w && ny>=0 && ny<h){
            sum+=mask[ny*w+nx];
            count++;
          }
        }
      }
      out[y*w+x] = (sum/count)>0.5?1:0;
    }
  }
  return out;
}

// Main loop
function render(){
  ctx.drawImage(video,0,0,width,height);
  const frame = ctx.getImageData(0,0,width,height);

  if(background && sampledHSV){
    const mask = new Uint8ClampedArray(width*height);

    for(let p=0,i=0; p<mask.length; p++,i+=4){
      const r=frame.data[i], g=frame.data[i+1], b=frame.data[i+2];
      const [h,s,v] = rgbToHsv(r,g,b);

      let dh = Math.abs(h - sampledHSV[0]);
      if(dh>180) dh = 360-dh;

      if(dh <= hRange.value && s >= sMin.value && v >= vMin.value){
        mask[p]=1;
      }
    }

    const smooth = smoothMask(mask,width,height);

    for(let p=0,i=0; p<smooth.length; p++,i+=4){
      if(smooth[p]){
        frame.data[i]   = background.data[i];
        frame.data[i+1] = background.data[i+1];
        frame.data[i+2] = background.data[i+2];
      }
    }

    if(previewMaskChk.checked){
      for(let p=0,i=0; p<smooth.length; p++,i+=4){
        if(smooth[p]){
          frame.data[i] = 255; frame.data[i+1] = 50; frame.data[i+2] = 50;
        }
      }
    }
  }

  ctx.putImageData(frame,0,0);
  requestAnimationFrame(render);
}
render();
