const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const money = n => "Rp " + Number(n).toLocaleString("id-ID");
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const toast = (message) => { const el=$("#toast"); el.textContent=message; el.classList.add("show"); clearTimeout(window.toastTimer); window.toastTimer=setTimeout(()=>el.classList.remove("show"),2800); };
const store = {
  get(k, d){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch{ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} },
};

/* ===================== KERANJANG ===================== */
// item: {id, name, price, qty, needsUsername}  — harga di sini hanya untuk tampilan; server menghitung ulang saat checkout.
let cart = store.get("zs_cart", []).filter(i => i && i.id && i.qty > 0);
let coupon = store.get("zs_coupon", "");
let quote = null; // hasil perhitungan server (diskon dsb.)

const subtotalLocal = () => cart.reduce((s,i)=>s+i.price*i.qty,0);
const saveCart = () => { store.set("zs_cart", cart); store.set("zs_coupon", coupon); };

async function refreshQuote(showErrors=false){
  quote = null;
  if (!cart.length) return renderTotals();
  try{
    const r = await fetch("/api/quote", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({items:cart.map(i=>({id:i.id,qty:i.qty})), coupon})});
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Gagal menghitung");
    quote = j;
  }catch(e){
    if (coupon){ coupon=""; saveCart(); if(showErrors) toast(e.message); }
  }
  renderTotals();
}

function renderTotals(){
  const sub = quote ? quote.subtotal : subtotalLocal();
  const disc = quote ? quote.discount : 0;
  $("#cartSubtotal").textContent = money(sub);
  $("#cartTotal").textContent = money(sub - disc);
  const row = $("#discountRow");
  row.hidden = !(quote && quote.coupon && disc > 0);
  if (!row.hidden){ $("#couponLabel").textContent = `(${quote.coupon.code})`; $("#cartDiscount").textContent = "-" + money(disc); }
  $("#couponInput").value = quote && quote.coupon ? quote.coupon.code : "";
  $("#checkoutBtn").disabled = !cart.length;
}

function renderCart(){
  $("#cartCount").textContent = cart.reduce((sum,item)=>sum+item.qty,0);
  const box = $("#cartItems");
  if(!cart.length){
    box.innerHTML = '<div class="empty-cart">🛒<b>Keranjang masih kosong</b><small>Tambahkan produk yang kamu suka.</small></div>';
  } else {
    box.innerHTML = cart.map((item,i)=>`<div class="cart-row"><div class="cart-product-icon">✦</div><div class="cart-row-info"><b>${esc(item.name)}</b><small>${money(item.price)}</small><div class="qty"><button data-dec="${i}" aria-label="Kurangi">−</button><span>${item.qty}</span><button data-inc="${i}" aria-label="Tambah">＋</button></div></div><div class="cart-line-total">${money(item.price*item.qty)}</div><button class="remove-item" data-remove="${i}" aria-label="Hapus produk">×</button></div>`).join("");
  }
  renderTotals();
}

function changeCart(){ saveCart(); renderCart(); refreshQuote(); }

$("#cartItems").addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return;
  if (b.dataset.inc !== undefined){ const it=cart[+b.dataset.inc]; if(it.qty<10&&(it.stock==null||it.qty<it.stock)) it.qty++; else toast(it.stock!=null&&it.qty>=it.stock?"Stok tersisa "+it.stock:"Maksimal 10 per produk."); }
  else if (b.dataset.dec !== undefined){ const it=cart[+b.dataset.dec]; it.qty--; if(it.qty<1) cart.splice(+b.dataset.dec,1); }
  else if (b.dataset.remove !== undefined){ cart.splice(+b.dataset.remove,1); }
  else return;
  changeCart();
});

document.addEventListener("click",e=>{
  const btn=e.target.closest(".add-cart"); if(!btn) return;
  const id=btn.dataset.id, name=btn.dataset.name, price=Number(btn.dataset.price);
  const stock=btn.dataset.stock===""||btn.dataset.stock===undefined?null:Number(btn.dataset.stock);
  if(stock===0) return toast("Stok habis");
  const existing=cart.find(i=>i.id===id);
  if(existing){ if(existing.qty>=10) return toast("Maksimal 10 per produk."); if(stock!==null&&existing.qty>=stock) return toast("Stok tersisa "+stock); existing.qty++; }
  else cart.push({id,name,price,qty:1,stock});
  changeCart(); toast(name+" ditambahkan ke keranjang");
  const c=$("#cartOpen"); c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump");
});

$("#couponForm").addEventListener("submit", async e => {
  e.preventDefault();
  const code = $("#couponInput").value.trim().toUpperCase();
  if(!code) return;
  if(!cart.length) return toast("Tambahkan produk dulu sebelum memakai kode promo.");
  coupon = code; await refreshQuote(true);
  if (quote && quote.coupon) { saveCart(); toast(`Kode ${quote.coupon.code} dipakai — hemat ${money(quote.discount)} 🎉`); }
});
$("#couponRemove").addEventListener("click", () => { coupon=""; saveCart(); refreshQuote(); });

const openCart  = () => $("#cartOverlay").classList.add("open");
const closeCart = () => $("#cartOverlay").classList.remove("open");
$("#cartOpen").addEventListener("click", openCart);
$("#cartClose").addEventListener("click", closeCart);
$("#cartOverlay").addEventListener("click", e => { if(e.target===$("#cartOverlay")) closeCart(); });

$("#checkoutBtn").addEventListener("click", () => {
  if(!cart.length) return toast("Keranjang kamu masih kosong.");
  closeCart();
  window.ZSCheckout.open({ cart: cart.map(i=>({...i})), coupon, quote });
});

/* ===================== FILTER, CARI, UI LAMA ===================== */
$$(".filter").forEach(btn=>btn.addEventListener("click",()=>{
  $$(".filter").forEach(b=>b.classList.remove("active"));btn.classList.add("active");
  const f=btn.dataset.filter;
  $$(".product-card").forEach(card=>card.style.display=(f==="all"||card.dataset.category===f)?"":"none");
}));
$("#loginClose").addEventListener("click",()=>$("#loginModal").classList.remove("open"));
$("#loginModal").addEventListener("click",e=>{if(e.target===$("#loginModal"))$("#loginModal").classList.remove("open")});
$("#mobileMenu").addEventListener("click",()=>$("#nav").classList.toggle("open"));
$$('#nav a').forEach(a=>a.addEventListener('click',()=>$("#nav").classList.remove("open")));
$("#searchToggle").addEventListener("click",()=>{const term=prompt("Cari produk ZayyStore:");if(!term)return;let found=0;$$("#productGrid .product-card").forEach(card=>{const match=card.innerText.toLowerCase().includes(term.toLowerCase());card.style.display=match?"":"none";if(match)found++;});$$(".filter").forEach(b=>b.classList.remove("active"));$("#produk").scrollIntoView({behavior:"smooth"});toast(found?`Ditemukan ${found} produk.`:"Produk tidak ditemukan.");});
$$(".quick-view").forEach(btn=>btn.addEventListener("click",()=>{const card=btn.closest(".product-card");card.querySelector(".add-cart").click();}));
document.addEventListener("keydown", e => { if(e.key==="Escape"){ closeCart(); $("#loginModal").classList.remove("open"); } });

/* ===================== KATEGORI (tab ala toko) ===================== */
const catInfo = id => { for(const c of (window.ZS_CATS||[])){ if(c.id===id) return {c,name:c.name,top:c.id}; for(const s of (c.subs||[])) if(s.id===id) return {c,name:s.name,top:c.id}; } return null; };
const catChip = id => { const i=id&&catInfo(id); return i?`<span class="sv-cat cat-${esc(i.top)}">${i.c.icon} ${esc(i.name)}</span>`:""; };
let curCat="all", curSub="";
function applyCat(){
  let shown=0;
  $$("#productGrid .product-card").forEach(card=>{
    const c=card.dataset.cat||"";
    const ok = curCat==="all" || (curSub ? c===curSub : (c===curCat || c.startsWith(curCat+"-")));
    card.style.display=ok?"":"none"; if(ok) shown++;
  });
  const em=$("#catEmpty"); if(em) em.hidden = shown>0 || !$$("#productGrid .product-card").length;
}
function pickCat(id,sub){
  curCat=id; curSub=sub||"";
  $$("#catTabs .filter").forEach(b=>{const on=b.dataset.cat===id; b.classList.toggle("active",on); b.setAttribute("aria-selected",on);});
  const c=(window.ZS_CATS||[]).find(x=>x.id===id), st=$("#subTabs");
  if(c&&c.subs&&c.subs.length){
    st.hidden=false;
    st.innerHTML=[{id:"",name:"Semua Mod"},...c.subs].map(s=>`<button type="button" class="${(s.id===curSub)?"active":""}" data-sub="${esc(s.id)}">${esc(s.name)}</button>`).join("");
  } else { st.hidden=true; st.innerHTML=""; }
  applyCat();
}
function buildTabs(){
  const cats=window.ZS_CATS||[], box=$("#catTabs"); if(!box||!cats.length) return;
  box.innerHTML=[{id:"all",name:"Semua",icon:"▦"},...cats].map(c=>`<button type="button" role="tab" class="filter sv-tab${c.id===curCat?" active":""}" data-cat="${esc(c.id)}"><i>${c.icon}</i>${esc(c.name)}</button>`).join("");
  const fc=$("#footCats"); if(fc) fc.innerHTML='<h4>Kategori</h4><a href="#produk" data-cat="all">Semua Produk</a>'+cats.map(c=>`<a href="#produk" data-cat="${esc(c.id)}">${esc(c.name)}</a>`).join("");
  if(!$("#catEmpty")) $("#productGrid").insertAdjacentHTML("afterend",'<div class="empty-cart" id="catEmpty" hidden style="padding:40px 0">📦<b>Belum ada produk di kategori ini</b><small>Coba kategori lain atau cek lagi nanti.</small></div>');
  pickCat(curCat,curSub);
}
document.addEventListener("click",e=>{
  const t=e.target.closest("#catTabs .filter"); if(t){ pickCat(t.dataset.cat,""); return; }
  const s=e.target.closest("#subTabs button"); if(s){ pickCat(curCat,s.dataset.sub); return; }
  const f=e.target.closest("#footCats a[data-cat]"); if(f){ pickCat(f.dataset.cat,""); }
});

/* ===================== PRODUK (dikelola admin) ===================== */
const DEMO={categories:[{id:"skins",name:"Skins",icon:"🧍"},{id:"premium",name:"Minecraft Premium",icon:"💎"},{id:"server",name:"Server Premium",icon:"🖥️"},{id:"plugin",name:"Plugin Server",icon:"🔌"},{id:"mod",name:"Mod Premium",icon:"🧩",subs:[{id:"mod-bedrock",name:"Mod Minecraft Bedrock"},{id:"mod-java",name:"Mod Minecraft Java"}]},{id:"setup",name:"Jasa Setup Server",icon:"🛠️"}],
  products:[["Custom Skin Minecraft",30000,"skins",1],["Bundle Akun Java + Skin",199000,"premium",1],["Server Minecraft 2GB",25000,"server",1],["Plugin EssentialsX Pro",25000,"plugin"],["Mod Dragon (Bedrock)",40000,"mod-bedrock",1],["Mod Tech (Java)",45000,"mod-java"],["Jasa Setup Server",50000,"setup"]].map(([name,price,cat,featured],i)=>({id:"demo"+i,name,price,cat,featured:!!featured,desc:"Contoh tampilan — data asli muncul saat web berjalan di server.",img:null}))};
async function loadProducts(demo){
  const card=(p,hot)=>`<article class="product-card sv-card" data-cat="${esc(p.cat||"")}"><div class="sv-img g-account">${hot?'<span class="sv-hot-tag">🔥 TERLARIS</span>':""}${p.bundle?'<span class="sv-bundle">★ PAKET HEMAT</span>':""}${p.img?`<img class="sv-photo-bg" src="${esc(p.img)}" alt="" aria-hidden="true"><img class="sv-photo" src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy">`:'<div class="sv-art"><b>ZAYY<br>STORE</b></div>'}</div><div class="sv-body">${catChip(p.cat)}<h3>${esc(p.name)}</h3><p>${esc(p.desc)}</p>${p.bundle?`<ul class="sv-inc">${p.bundle.map(n=>`<li>${esc(n)}</li>`).join("")}</ul>`:""}${p.detail?`<button type="button" class="sv-detail" data-detail="${esc(p.id)}">ℹ️ Lihat detail</button>`:""}<div class="sv-price">${p.bundle&&p.worth>p.price?`<s>${money(p.worth)}</s><em>Hemat ${money(p.worth-p.price)}</em>`:""}<strong>${money(p.price)}</strong></div>${p.stock!=null?`<div class="sv-stock${p.stock===0?" out":""}">${p.stock===0?"Stok habis":"Stok tersisa: "+p.stock}</div>`:""}<button class="add-cart sv-buy${p.stock===0?" soldout":""}" data-id="${esc(p.id)}" data-name="${esc(p.name)}" data-price="${p.price}" data-stock="${p.stock==null?"":p.stock}" aria-label="Tambah ${esc(p.name)} ke keranjang">${p.stock===0?"Stok Habis":"🛒 Beli Sekarang"}</button></div></article>`;
  const grid=$("#productGrid");
  try{
    const data=demo||await (await fetch("/api/products")).json(); const list=data.products||[];
    window.ZS_LIST=list;window.ZS_CATS=data.categories||[];window.ZS_PROMO=data.promo||null; document.dispatchEvent(new CustomEvent("zs:promo",{detail:window.ZS_PROMO}));
    grid.innerHTML = list.length ? list.map(p=>card(p)).join("")
      : '<div class="empty-cart" style="grid-column:1/-1;padding:40px 0">📦<b>Belum ada produk</b><small>Produk akan muncul setelah admin menambahkannya.</small></div>';
    buildTabs();
    const hotSec=$("#terlaris"), feat=list.filter(p=>p.featured);
    $("#featGrid").innerHTML=feat.map(p=>card(p,true)).join(""); hotSec.hidden=!feat.length;
    if(demo&&!$("#demoNote")) $("#catTabs").insertAdjacentHTML("beforebegin",'<div id="demoNote" class="sv-demo">👀 <b>Mode pratinjau</b> — kamu membuka file langsung dari folder, jadi ini produk CONTOH. Produk asli & pembayaran jalan setelah web di-deploy ke Vercel (atau jalankan <code>node scripts/dev.js</code>).</div>');
    const ids=new Set(list.map(p=>p.id)), n=cart.length;
    cart=cart.filter(i=>ids.has(i.id)); if(cart.length!==n) changeCart();
  }catch{
    if(location.protocol==="file:" && !demo){ loadProducts(DEMO); return; }
    grid.innerHTML='<div class="empty-cart" style="grid-column:1/-1;padding:40px 0">⚠️<b>Produk gagal dimuat</b><small>Muat ulang halaman.</small></div>';
  }
}
loadProducts();

renderCart();
if (cart.length) refreshQuote();

window.toast = toast;
// Setelah pesanan dibuat, keranjang dikosongkan (pesanan tersimpan di "Pesanan Saya").
document.addEventListener("zs:ordercreated", () => { cart = []; coupon = ""; quote = null; saveCart(); renderCart(); });

/* ===================== DETAIL PRODUK ===================== */
(() => {
  const ov = $("#detailOverlay"), close = () => ov.classList.remove("open");
  document.addEventListener("click", e => {
    const b = e.target.closest(".sv-detail"); if (!b) return;
    const p = (window.ZS_LIST || []).find(x => x.id === b.dataset.detail); if (!p) return;
    $("#dtTitle").textContent = p.name;
    $("#dtPrice").textContent = money(p.price) + (p.stock != null ? " • " + (p.stock === 0 ? "Stok habis" : "Stok " + p.stock) : "");
    $("#dtDesc").textContent = p.desc || "";
    $("#dtBody").textContent = p.detail || "";
    $("#dtBuy").dataset.id = p.id;
    ov.classList.add("open");
  });
  $("#dtBuy").addEventListener("click", e => { const btn = document.querySelector(`.add-cart[data-id="${e.currentTarget.dataset.id}"]`); close(); if (btn) btn.click(); });
  $("#dtClose").addEventListener("click", close);
  ov.addEventListener("click", e => { if (e.target === ov) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
})();
