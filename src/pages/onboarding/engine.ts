// @ts-nocheck
/* Generated from mrg-hub_5.html. Do not edit by hand: change the design and regenerate. */
const ONBOARDING_CSS_BASE = ":host{display:block;height:100%;min-height:0;overflow:hidden;background:#fff}\n.onb,.app{height:100%;min-height:0}\n\n/* =========================================================\n   Tokens — palette in OKLCH, alpha borders, one type scale\n   ========================================================= */\n:host, :root{\n  --bg:      oklch(1 0 0);\n  --panel:   oklch(0.975 0.003 95);\n  --ink:     oklch(0.21 0.006 285);   /* headings, primary text */\n  --ink2:    oklch(0.32 0.006 285);   /* body */\n  --muted:   oklch(0.45 0.008 285);   /* meta — still ≥ 7:1 on white */\n  --line:    rgb(0 0 0 / 0.11);\n  --line-2:  rgb(0 0 0 / 0.06);\n  --hover:   rgb(0 0 0 / 0.04);\n  --press:   rgb(0 0 0 / 0.07);\n  --gold:    oklch(0.72 0.095 85);\n  --goldtint:oklch(0.975 0.022 90);\n  --goldink: oklch(0.45 0.08 80);\n\n  /* status hues — equal lightness, so no colour shouts louder than another */\n  --blue:  oklch(0.6 0.15 255);\n  --amber: oklch(0.6 0.14 65);\n  --red:   oklch(0.6 0.19 25);\n  --grey:  oklch(0.6 0.015 270);\n  --teal:  oklch(0.6 0.11 185);\n  --green: oklch(0.6 0.13 155);\n  --redink:oklch(0.48 0.17 25);\n  --amberink:oklch(0.47 0.12 60);\n\n  /* type scale */\n  --t-xs: 12px; --t-sm: 13px; --t-base: 14px; --t-md: 16px; --t-lg: 24px;\n\n  /* radii (nested: inner = outer − padding) */\n  --r-card: 16px; --r-ctl: 10px; --r-pill: 999px;\n\n  /* motion: always in-out, always < 300ms */\n  --ease: cubic-bezier(.65,0,.35,1);\n  --fast: 110ms; --med: 180ms; --slow: 260ms;\n\n  --safe-b: env(safe-area-inset-bottom, 0px);\n  --safe-t: env(safe-area-inset-top, 0px);\n}\n*{box-sizing:border-box}\n[hidden]{display:none!important}\n:host, .app{margin:0;background:var(--bg);color:var(--ink2);font-family:Inter,system-ui,-apple-system,sans-serif;font-size:var(--t-base);line-height:1.5;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}\nbutton,input,select,textarea{font:inherit;color:inherit}\nbutton{cursor:pointer;-webkit-user-select:none;user-select:none}\n::placeholder{color:oklch(0.52 0.008 285)}\n:focus-visible{outline:2px solid oklch(0.6 0.15 255 / .55);outline-offset:2px}\nh1,h2,h3,h4{color:var(--ink);margin:0}\n.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}\n\n/* icons — stroke follows the weight of adjacent text */\nsvg.i{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}\nsvg.i.sm{width:16px;height:16px}\n.w6 svg.i, svg.i.w6{stroke-width:2.1}\n\n/* icon swap: outgoing icon blurs as it fades */\n.swap{display:inline-grid;place-items:center}\n.swap>svg{grid-area:1/1;transition:opacity var(--med) var(--ease),filter var(--med) var(--ease),transform var(--med) var(--ease)}\n.swap>.b{opacity:0;filter:blur(4px);transform:scale(.6)}\n.swap.on>.a{opacity:0;filter:blur(4px);transform:scale(.6)}\n.swap.on>.b{opacity:1;filter:none;transform:none}\n\n/* =========================================================\n   One card style — used everywhere\n   ========================================================= */\n.card{background:var(--bg);border:1px solid var(--line);border-radius:var(--r-card)}\n.cardhead{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line-2);flex-wrap:wrap;min-height:60px}\n.cardhead h3{font-size:var(--t-md);font-weight:600;display:flex;align-items:center;gap:8px}\n.count{font-size:var(--t-xs);font-weight:600;color:var(--ink2);background:var(--panel);border:1px solid var(--line-2);border-radius:var(--r-pill);padding:1px 8px}\n\n/* =========================================================\n   Buttons\n   ========================================================= */\n.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:var(--r-ctl);padding:0 14px;height:40px;font-size:var(--t-sm);font-weight:500;border:1px solid var(--line);background:var(--bg);color:var(--ink);white-space:nowrap;\n  transition:background var(--fast) var(--ease),transform var(--fast) var(--ease),border-color var(--fast) var(--ease)}\n.btn:hover{background:var(--hover)}\n.btn:active{transform:scale(.97);background:var(--press)}\n.btn.sm{height:34px;padding:0 12px;font-size:var(--t-xs);border-radius:8px}\n.btn.sm::after{content:\"\";position:absolute;inset:-5px -2px}           /* larger hit area */\n.btn.primary{background:var(--ink);border-color:transparent;color:#fff;font-weight:600}\n.btn.primary svg.i{stroke-width:2.1}\n.btn.primary:hover{background:oklch(0.29 0.006 285)}\n.btn.primary:active{background:oklch(0.17 0.006 285)}\n.btn.ok,.btn.ok:hover{background:oklch(0.94 0.05 155);border-color:oklch(0.6 0.13 155 / .35);color:oklch(0.4 0.1 155)}\n.btn:disabled{cursor:default}\n.btn:disabled:not(.ok){opacity:.5}\n\n/* rewarding hover on the main CTAs */\n.cta-add .plus{transition:transform var(--slow) var(--ease)}\n.cta-add:hover .plus{transform:rotate(90deg)}\n.cta-go .swap>.a{transition:transform var(--med) var(--ease),opacity var(--med) var(--ease),filter var(--med) var(--ease)}\n.cta-go:hover:not(:disabled) .swap:not(.on)>.a{transform:translateX(3px)}\n\n/* key moment: pushed feedback */\n@keyframes push{0%{transform:scale(1)}35%{transform:scale(.94)}75%{transform:scale(1.04)}100%{transform:scale(1)}}\n.pushed{animation:push var(--slow) var(--ease)}\n@keyframes land{0%{background:var(--bg)}50%{background:oklch(0.95 0.05 155)}100%{background:var(--bg)}}\n\n.iconbtn{position:relative;width:36px;height:36px;border-radius:9px;border:1px solid transparent;background:none;display:inline-grid;place-items:center;color:var(--ink2);transition:background var(--fast) var(--ease),transform var(--fast) var(--ease)}\n.iconbtn::after{content:\"\";position:absolute;inset:-4px}\n.iconbtn:hover{background:var(--hover)}\n.iconbtn:active{transform:scale(.94);background:var(--press)}\n\nkbd{font:600 11px/1 Inter,sans-serif;color:var(--ink2);background:var(--bg);border:1px solid var(--line);border-bottom-width:2px;border-radius:5px;padding:3px 5px}\n\n/* =========================================================\n   Layout\n   ========================================================= */\n.app{--sw:232px;display:grid;grid-template-columns:var(--sw) minmax(0,1fr) 300px;height:100%;overflow:hidden;transition:grid-template-columns var(--slow) var(--ease)}\n.side{height:100%;min-height:0;border-right:1px solid var(--line);background:var(--bg);display:flex;flex-direction:column;padding:20px 12px 14px;overflow-y:auto}\n.brand{display:flex;align-items:center;gap:10px;padding:0 8px}\n.logo{width:34px;height:34px;flex:none;display:block}\n.brand b{flex:1;min-width:0;white-space:nowrap;overflow:hidden}\n.sidetog{margin-right:-6px;flex:none}\n.sidetog .chv{transition:transform var(--med) var(--ease);transform-origin:14.5px 12px}\n/* collapsed sidebar → icon rail */\n:host(.sb-collapsed) .app.app{--sw:68px}\n:host(.sb-collapsed) .side{padding-left:10px;padding-right:10px}\n:host(.sb-collapsed) .side .brand{flex-direction:column;gap:12px;padding:0}\n:host(.sb-collapsed) .side .brand b,:host(.sb-collapsed) .side .nl,:host(.sb-collapsed) .side kbd,:host(.sb-collapsed) .navgroup h4{display:none}\n:host(.sb-collapsed) .sidetog{margin:0}\n:host(.sb-collapsed) .sidetog .chv{transform:scaleX(-1)}\n:host(.sb-collapsed) .jump{justify-content:center;padding:0}\n:host(.sb-collapsed) .nav button{justify-content:center;padding:0;gap:0}\n:host(.sb-collapsed) .navgroup{margin-top:10px;padding-top:10px;border-top:1px solid var(--line-2)}\n:host(.sb-collapsed) .navgroup:first-child{border-top:0;padding-top:0}\n:host(.sb-collapsed) .me{justify-content:center;padding:12px 0 0}\n.mark{width:32px;height:32px;border-radius:9px;border:1.5px solid var(--gold);display:grid;place-items:center;color:var(--gold);font-weight:700;font-size:17px;letter-spacing:-.5px;flex:none}\n.brand b{font-size:var(--t-md);font-weight:650;color:var(--ink);letter-spacing:-.2px}\n.jump{display:flex;align-items:center;gap:10px;margin:18px 0 6px;width:100%;height:40px;padding:0 10px;border-radius:var(--r-ctl);border:1px solid var(--line);background:var(--bg);color:var(--ink2);font-size:var(--t-sm);transition:background var(--fast) var(--ease)}\n.jump:hover{background:var(--hover)}\n.jump span{flex:1;text-align:left}\n.navgroup{margin-top:16px}\n.navgroup h4{font-size:var(--t-xs);font-weight:600;color:var(--muted);padding:0 12px 4px;letter-spacing:.1px}\n.nav button{display:flex;align-items:center;gap:11px;width:100%;border:1px solid transparent;background:none;height:40px;padding:0 12px;border-radius:10px;color:var(--ink2);font-size:var(--t-base);font-weight:500;text-align:left;transition:background var(--fast) var(--ease)}\n.nav button:hover{background:var(--hover)}\n.nav button:active{background:var(--press)}\n.nav button.active{border-color:rgb(0 0 0 / .1);background:rgb(0 0 0 / .045);color:var(--ink);font-weight:600}\n.nav button.active svg.i{stroke-width:2.1}\n.side .spacer{flex:1;min-height:16px}\n.side .foot{border-top:1px solid var(--line-2);padding-top:10px}\n.me{display:flex;align-items:center;gap:10px;padding:12px 12px 0;font-size:var(--t-sm);color:var(--ink);font-weight:500}\n.me small{display:block;color:var(--muted);font-size:var(--t-xs);font-weight:400}\n\nmain{min-width:0;width:100%;height:100%;min-height:0;overflow-y:auto;overflow-x:hidden;padding:28px 32px 40px;-webkit-overflow-scrolling:touch}\n.right{height:100%;min-height:0;overflow-y:auto;border-left:1px solid var(--line);background:var(--panel);padding:24px 16px;display:flex;flex-direction:column;gap:16px;-webkit-overflow-scrolling:touch}\n\n/* =========================================================\n   Header + stats\n   ========================================================= */\n.mtop{display:none}\n.headacts{display:flex;align-items:center;gap:8px}\n.rtop{display:flex;align-items:center;justify-content:space-between;margin:-6px -4px -4px 4px}\n.rtop h2{font-size:var(--t-md);font-weight:600}\n@media (min-width:1024px){\n  :host(.rp-closed) .app.app{grid-template-columns:var(--sw) minmax(0,1fr)}\n  :host(.rp-closed) .right{display:none}\n}\n@media (max-width:1023px){ .rtop{display:none} #rpOpen{display:none!important} }\n.head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px}\n.head .date{color:var(--muted);font-size:var(--t-sm);font-weight:500;margin-bottom:2px}\n.head h1{font-size:var(--t-lg);font-weight:700;letter-spacing:-.4px;line-height:1.25}\n\n.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));padding:6px;gap:6px;margin-bottom:28px}\n.stat{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:calc(var(--r-card) - 6px)}\n.stat+.stat{box-shadow:-4px 0 0 -3px var(--line)}\n.stat .ic{width:36px;height:36px;border-radius:50%;background:var(--panel);display:grid;place-items:center;color:var(--ink2);flex:none;overflow:hidden;isolation:isolate}\n.stat b{display:block;font-size:20px;font-weight:650;color:var(--ink);line-height:1.15;font-variant-numeric:tabular-nums}\n.stat span.l{font-size:var(--t-xs);font-weight:500;color:var(--muted)}\n.stat.alert b{color:var(--redink)}\n.dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none}\n\n/* section bar: title + its controls on top */\n.secbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;flex-wrap:wrap}\n.secbar h2{font-size:var(--t-md);font-weight:600;display:flex;align-items:center;gap:8px}\n\n/* segmented control: outer 12 / pad 3 → inner 9 */\n.seg{display:inline-flex;background:var(--panel);border:1px solid var(--line-2);border-radius:12px;padding:3px}\n.seg button{border:0;background:none;border-radius:9px;height:34px;padding:0 16px;font-size:var(--t-sm);font-weight:500;color:var(--ink2);transition:background var(--fast) var(--ease),color var(--fast) var(--ease)}\n.seg button:hover{color:var(--ink)}\n.seg button.on{background:var(--bg);color:var(--ink);font-weight:600;box-shadow:0 0 0 1px var(--line)}\n\n/* chips */\n.chip{display:inline-flex;align-items:center;gap:5px;border-radius:var(--r-pill);padding:3px 10px;font-size:var(--t-xs);font-weight:600;white-space:nowrap;line-height:1.35}\n.addrline{display:inline-flex;align-items:center;flex-wrap:wrap;gap:8px}\n.newpill{flex:none}\n.furnb{display:inline-flex;border-radius:var(--r-pill);padding:1px 8px;font-size:11px;font-weight:600;margin-left:8px;white-space:nowrap}\n.furnb.client{background:oklch(0.6 0.13 155 / .15);color:oklch(0.42 0.1 155)}\n.furnb.fip{background:oklch(0.6 0.11 185 / .15);color:oklch(0.42 0.09 185)}\n.furnb.contest{background:oklch(0.72 0.095 85 / .2);color:var(--goldink)}\n.furn{grid-column:1 / -1;border:0;margin:0;padding:12px 14px;background:var(--panel);border-radius:12px;display:flex;flex-direction:column;gap:6px}\n.furn legend{float:left;width:100%;padding:0;margin-bottom:4px;font-size:var(--t-sm);font-weight:600;color:var(--ink)}\n.furnopt{display:flex;align-items:flex-start;gap:10px;min-height:40px;padding:6px 8px;border-radius:10px;cursor:pointer;transition:background var(--fast) var(--ease)}\n.furnopt:hover{background:var(--hover)}\n.furnopt input{margin:3px 0 0;width:16px;height:16px;accent-color:var(--ink);flex:none}\n.furnopt b{display:block;font-size:var(--t-sm);font-weight:600;color:var(--ink)}\n.furnopt span{font-size:var(--t-xs);font-weight:500;color:var(--ink2)}\n.furn .field{margin:4px 0 0 34px;max-width:260px}\n.furn .hint{margin:2px 0 0 34px}\n.av{width:28px;height:28px;border-radius:50%;display:inline-grid;place-items:center;font-size:11px;font-weight:600;color:#fff;flex:none}\n.av.sm{width:24px;height:24px;font-size:10px}\n\n/* =========================================================\n   Pipeline table\n   ========================================================= */\n.tablebox{overflow-x:auto;border-radius:var(--r-card);width:100%}.tablebox table{min-width:920px;width:100%}.tablebox th.prop,.tablebox td.prop{min-width:220px;max-width:none;width:28%}\ntable{width:100%;border-collapse:collapse;min-width:700px}\nth{background:var(--panel);text-align:left;font-size:var(--t-xs);font-weight:600;color:var(--muted);padding:10px 12px;border-bottom:1px solid var(--line-2);white-space:nowrap}\ntd{padding:12px;border-bottom:1px solid var(--line-2);vertical-align:middle;font-size:var(--t-sm)}\ntbody tr:last-child td{border-bottom:0}\ntr.row{cursor:pointer}\ntr.row:hover td{background:oklch(0.985 0.002 95)}\ntr.row.open td{background:var(--panel);border-bottom-color:transparent}\ntr.row.landed td{animation:land 600ms var(--ease)}\n.prop b{display:block;font-weight:600;font-size:var(--t-base);color:var(--ink);white-space:normal;overflow-wrap:anywhere}\n.meta{color:var(--muted);font-size:var(--t-xs);font-weight:500}\n.who{display:flex;align-items:center;gap:8px;white-space:nowrap}\n.who b{font-weight:500;color:var(--ink)}\n.status{display:flex;align-items:flex-start;gap:7px;color:var(--ink);font-weight:500;white-space:nowrap}\n.status .dot{margin-top:6px}\n.status small{display:block;color:var(--muted);font-size:var(--t-xs);font-weight:500;white-space:normal;max-width:150px;line-height:1.35}\n.due{white-space:nowrap;color:var(--ink);font-weight:500}\n.due.late{color:var(--redink);font-weight:600}\n.due.today{color:var(--amberink);font-weight:600}\n.acts{display:flex;gap:2px;justify-content:flex-end}\n.flagbtn.on{color:var(--redink);width:auto;padding:0 8px;gap:3px;display:inline-flex;align-items:center;font-weight:600;font-size:var(--t-sm)}\n.chev{transition:transform var(--med) var(--ease)}\n.open .chev{transform:rotate(180deg)}\n\n/* =========================================================\n   Detail (expanded unit) — actions at the top\n   ========================================================= */\n.detail td{background:var(--panel);padding:0 12px 14px}\n.detail .dwrap{position:sticky;left:12px;width:calc(var(--boxw,100%) - 26px)}\n.dwrap{background:var(--bg);border:1px solid var(--line);border-radius:var(--r-card)}\n.dhead{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line-2);flex-wrap:wrap}\n.dhead h4{font-size:var(--t-md);font-weight:600;display:flex;align-items:center;gap:10px;flex-wrap:wrap}\n.dhead .meta{font-size:var(--t-sm)}\n.dacts{display:flex;gap:8px;flex-wrap:wrap}\n.dbody{padding:14px 16px 16px;display:flex;flex-direction:column;gap:16px}\n\n.phases{display:flex;flex-wrap:wrap;gap:10px}\n.phase{flex:var(--n,3) 1 calc(var(--n,3) * 86px + 16px);min-width:0;background:var(--panel);border-radius:12px;padding:10px 8px 10px}\n.phase h5{margin:0 0 8px;padding:0 6px;font-size:var(--t-xs);font-weight:600;color:var(--ink2);display:flex;justify-content:space-between}\n.phase h5 span{color:var(--muted);font-weight:500}\n.steps{display:flex}\n.step{flex:1 1 0;min-width:0;overflow-wrap:break-word;hyphens:auto;display:flex;flex-direction:column;align-items:center;position:relative;text-align:center;font-size:var(--t-xs);font-weight:500;color:var(--muted);line-height:1.3;padding:0 2px}\n.step:not(:last-child)::after{content:\"\";position:absolute;top:11px;left:calc(50% + 14px);right:calc(-50% + 14px);height:2px;border-radius:2px;background:var(--line)}\n.step.done:not(:last-child)::after{background:oklch(0.6 0.11 185 / .45)}\n.step .c{width:24px;height:24px;border-radius:50%;border:2px solid var(--line);background:var(--bg);display:grid;place-items:center;margin-bottom:5px;position:relative;z-index:1}\n.step.done{color:var(--ink2)}\n.step.done .c{background:var(--teal);border-color:transparent;color:#fff}\n.step.done .c svg{width:13px;height:13px;stroke-width:2.6}\n.step.cur{color:var(--ink);font-weight:600}\n.step.cur .c::after{content:\"\";width:8px;height:8px;border-radius:50%;background:var(--sc)}\n.step.cur .c{border-color:var(--sc)}\n\n.step.skip{opacity:.25;pointer-events:none}.step.skip.na{opacity:.55;pointer-events:auto;cursor:pointer}.step.skip.na:hover{opacity:.8}button.step{font:inherit;color:inherit;text-align:center;border:0;background:none;padding:0 2px;appearance:none;-webkit-appearance:none}\n.step.skip .lbl{text-decoration:line-through;text-decoration-color:rgb(0 0 0 / .35)}\n.step.skip .c{background:oklch(0.85 0.005 285);border-color:transparent}\n.tasks li.owner .tn{color:var(--ink2)}\n.ownrow{flex:1;display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px;min-height:44px;min-width:0;padding:4px 0}\n.ownrow .tn{flex:1 1 160px;min-width:0}\n.ownrow .dot{width:10px;height:10px;margin:0 5px}\n.tasks .tdue.wait{color:var(--amberink);font-weight:600;white-space:nowrap}\n.btn.ghost{border-color:transparent;background:none;color:var(--ink2);padding:0 10px;margin-left:-10px}\n.btn.ghost:hover{background:var(--hover);color:var(--ink)}\n.advance{margin-top:14px;padding-top:14px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:10px}\n.advance h5{margin:0;font-size:var(--t-md);font-weight:600;color:var(--ink)}\n.advance .hint{margin:0}\n.advrow{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap}\n.advrow .field{display:flex;flex-direction:column}\n.advrow .field label{font-size:var(--t-xs);margin-bottom:4px}\n.advrow .field .input{width:170px}\n.docs h5{margin:0 0 8px;font-size:var(--t-sm);font-weight:600;color:var(--ink);display:flex;align-items:center;gap:7px}\n.doclist{list-style:none;margin:0 0 10px;padding:0;border:1px solid var(--line-2);border-radius:12px}\n.doclist li{display:flex;align-items:center;gap:10px;padding:6px 6px 6px 12px;font-size:var(--t-sm);min-height:48px;border-bottom:1px solid var(--line-2)}\n.doclist li:last-child{border-bottom:0}\n.doclist li>svg{color:var(--redink)}\n.doclist .dn{flex:1;min-width:0;color:var(--ink);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.drop{display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px;border:1.5px dashed rgb(0 0 0 / .2);border-radius:12px;color:var(--ink2);font-size:var(--t-sm);font-weight:600;cursor:pointer;transition:background var(--fast) var(--ease),border-color var(--fast) var(--ease)}\n.drop:hover{background:var(--panel);border-color:rgb(0 0 0 / .32);color:var(--ink)}\n.drop:active{transform:scale(.99)}\n.drop:focus-within{box-shadow:0 0 0 3px oklch(0.6 0.15 255 / .2)}\n@media (max-width:767px){.advrow .field{flex:1 1 140px}.advrow .field .input{width:100%}.advrow .btn{flex:1 1 100%}.doclist .meta{display:none}}\n.stepof{display:block;margin-top:5px;font-size:var(--t-xs);font-weight:500;color:var(--muted);white-space:nowrap}\n.mcard .chips{align-items:center}\n.mcard .chips .stepof{display:inline;margin:0 0 0 2px}\n.stabs{display:flex;flex-wrap:wrap;gap:2px;overflow-x:visible;border-bottom:1px solid var(--line);margin:0 12px -4px 0;padding-right:12px;scrollbar-width:thin;-webkit-overflow-scrolling:touch}\n.stab{flex:none;display:flex;align-items:center;gap:7px;height:42px;padding:0 12px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:none;border-radius:8px 8px 0 0;font-size:var(--t-sm);font-weight:500;color:var(--ink2);white-space:nowrap;transition:background var(--fast) var(--ease),color var(--fast) var(--ease)}\n.stab:hover{background:var(--hover);color:var(--ink)}\n.stab:active{background:var(--press)}\n.stab .d{width:7px;height:7px;border-radius:50%;flex:none;background:oklch(0.82 0.005 285)}\n.stab.past .d{background:var(--teal)}\n.stab.cur{font-weight:600;color:var(--ink)}\n.stab.cur .d{background:var(--sc)}\n.stab.future{color:var(--muted)}\n.stab.sel{border-bottom-color:var(--sc);color:var(--ink);font-weight:600}\n.stagenote{display:block;margin-top:2px;font-size:var(--t-xs);font-weight:500;font-style:italic;color:var(--muted)}\n.tasks li.ro input[type=checkbox]{cursor:default}\n.teamnote{margin-top:4px;font-size:11px;font-style:italic;font-weight:500;color:var(--muted)}\n.teamwarn{margin-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:var(--t-xs);font-weight:500;color:var(--amberink);background:oklch(0.6 0.14 65 / .12);border-radius:10px;padding:6px 10px}\n.linkbtn{border:0;background:none;padding:0;color:inherit;font:inherit;font-weight:600;text-decoration:underline;text-underline-offset:2px;cursor:pointer}\n.nabtn{border:1px solid transparent;background:none;border-radius:6px;height:28px;padding:0 7px;font-size:11px;font-weight:600;color:var(--muted);position:relative;flex:none}\n.nabtn::after{content:\"\";position:absolute;inset:-8px -4px}\n.nabtn:hover{background:var(--hover);color:var(--ink)}\n.nabtn.on{background:oklch(0.6 0.015 270 / .14);color:var(--ink2)}\n.nalbl{font-size:11px;font-weight:600;color:var(--muted);flex:none}\n.nadash{width:18px;text-align:center;color:var(--muted);font-weight:600;flex:none}\n.tasks li.na .tn{color:var(--muted);text-decoration:line-through;text-decoration-color:rgb(0 0 0 / .3)}\n.skiprow{margin-top:8px}\n.skiprow .btn.ghost{margin-left:-10px}\n.skipask{margin-top:10px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px 12px;border-radius:12px;background:oklch(0.6 0.19 25 / .07);border:1px solid oklch(0.6 0.19 25 / .2);font-size:var(--t-sm);color:var(--ink)}\n.skipbtns{display:flex;gap:6px}\n.btn.danger{background:oklch(0.55 0.17 25);border-color:transparent;color:#fff;font-weight:600}\n.btn.danger:hover{background:oklch(0.5 0.17 25)}\n.skipbox{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:16px;border:1.5px dashed rgb(0 0 0 / .14);border-radius:12px;color:var(--ink)}\n.skipbox .btn{margin:4px 0 0 -10px}\n.step.na .c{background:transparent;border:1.5px solid oklch(0.6 0.005 285);position:relative;overflow:hidden}\n.step.na .c::before{content:\"\";position:absolute;left:50%;top:-2px;bottom:-2px;width:1.5px;background:oklch(0.6 0.005 285);transform:rotate(45deg)}\n.stab.na{color:var(--muted)}\n.stab.na .d{background:transparent;box-shadow:inset 0 0 0 1.5px oklch(0.65 0.005 285)}\n.stab.ho svg.i{width:15px;height:15px}\n.hodl{margin:0;display:grid;grid-template-columns:180px minmax(0,1fr);gap:10px 16px;font-size:var(--t-sm)}\n.hodl dt{color:var(--muted);font-weight:500}\n.hodl dd{margin:0;color:var(--ink);font-weight:500;white-space:pre-line}\n.hoform{display:grid;grid-template-columns:1fr 1fr;gap:12px 14px}\n.hoform .full{grid-column:1 / -1}\n.hoform .field label,.hoform .flabel{display:block;font-size:var(--t-xs);font-weight:600;color:var(--ink);margin-bottom:5px}\n.hoform .field label em{font-style:normal;font-weight:500;color:var(--muted)}\n.hoform .input{width:100%}\n.hoform textarea.input{height:auto;min-height:72px;padding:10px 12px}\n.segopt{display:inline-flex;cursor:pointer}\n.segopt span{display:inline-flex;align-items:center;height:34px;padding:0 16px;border-radius:9px;font-size:var(--t-sm);font-weight:500;color:var(--ink2)}\n.segopt input:checked+span{background:var(--bg);color:var(--ink);font-weight:600;box-shadow:0 0 0 1px var(--line)}\n.segopt input:focus-visible+span{outline:2px solid oklch(0.6 0.15 255 / .55)}\n.hoacts{display:flex;justify-content:flex-end;gap:8px}\n.tasks li.addtask{border-bottom:0}\n.addbtn{display:flex;align-items:center;gap:8px;width:100%;min-height:44px;border:0;background:none;padding:0 2px;border-radius:8px;color:var(--muted);font-size:var(--t-sm);font-weight:500;text-align:left;transition:background var(--fast) var(--ease),color var(--fast) var(--ease)}\n.addbtn svg.i{transition:transform var(--med) var(--ease)}\n.addbtn:hover{background:var(--hover);color:var(--ink)}\n.addbtn:hover svg.i{transform:rotate(90deg)}\n.addbtn:active{background:var(--press)}\n.addtask.open{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:8px;align-items:center;padding:10px;margin-top:4px;background:var(--panel);border-radius:12px}\n.addtask.open .input{height:36px;font-size:var(--t-sm);width:100%}\n.addtask.open .atbtns{display:flex;gap:4px}\n.addtask.open .atname{grid-column:1 / -1}\n.addtask.open .athint,.addtask.open .teamnote,.addtask.open .teamwarn{grid-column:1 / -1;margin:0}\n.tdel{width:28px;height:28px;flex:none}\n.applink{margin-left:8px;font-size:12px;font-weight:600;font-style:normal;color:var(--teal);text-decoration:none;white-space:nowrap}\n.applink:hover{text-decoration:underline;text-underline-offset:2px}\n.delivrow{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:6px}\n.dpill{position:relative;display:inline-flex;align-items:center;height:30px;padding:0 12px;border-radius:var(--r-pill);border:1px solid var(--line);background:var(--bg);font-size:var(--t-xs);font-weight:500;color:var(--ink2);transition:background var(--fast) var(--ease)}\n.dpill::after{content:\"\";position:absolute;inset:-7px -2px}\nbutton.dpill:hover{background:var(--hover)}\nbutton.dpill:active{transform:scale(.97)}\n.dpill.on{background:var(--ink);border-color:transparent;color:#fff;font-weight:600}\n.furnopt.soon{opacity:.55;cursor:not-allowed}\n.soontag{font-style:normal;font-weight:600;font-size:11px;color:var(--ink2);background:oklch(0.6 0.015 270 / .14);border-radius:var(--r-pill);padding:1px 7px;margin-left:6px}\n.furn.disabled .furnopt{opacity:.45;cursor:not-allowed}\n.furn .field label{display:block;font-size:var(--t-xs);font-weight:600;color:var(--ink);margin-bottom:0}\n.furn .field label .input{margin-top:5px}\n.furnoff{color:var(--ink2);font-style:italic}\n.factsrow{display:flex;align-items:center;align-content:flex-start;flex-wrap:wrap;gap:8px 12px;padding:10px 12px;background:var(--panel);border-radius:12px;font-size:var(--t-sm);color:var(--ink2)}\n.factsrow b{color:var(--ink);font-weight:600}\n.factsrow>span:not(.chip)+span:not(.chip)::before{content:\"\";display:inline-block;width:1px;height:12px;background:var(--line);margin-right:14px;vertical-align:-1px}\n.warnchip{background:oklch(0.6 0.19 25 / .12);color:var(--redink)}\n.mask{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap}\n.mask .dots{letter-spacing:2px;color:var(--ink2)}\n.eyebtn{position:relative;display:inline-flex;align-items:center;gap:5px;border:0;background:none;padding:2px 6px;border-radius:6px;color:var(--teal);font-size:var(--t-xs);font-weight:600}\n.eyebtn::after{content:\"\";position:absolute;inset:-8px -4px}\n.eyebtn:hover{background:var(--hover)}\n.pwfield{position:relative}\n.pwfield .input{padding-right:40px}\n.eyebtn.in{position:absolute;right:4px;top:50%;transform:translateY(-50%);width:32px;height:32px;justify-content:center;padding:0;color:var(--ink2)}\n.tdone{flex-basis:100%;margin:-6px 0 0 28px;font-size:11px;font-weight:500;color:var(--muted)}\n.tasks label{flex-wrap:wrap}\n.hist{border-top:1px solid var(--line-2);padding-top:12px}\n.hist h5{margin:0 0 8px;font-size:var(--t-sm);font-weight:600;color:var(--ink);display:flex;align-items:center;gap:7px}\n.hist ul{list-style:none;margin:0 0 6px;padding:0;border-radius:10px;overflow:hidden}\n.hist li{display:flex;justify-content:space-between;gap:12px;padding:7px 10px;font-size:var(--t-xs);color:var(--ink2)}\n.hist li:nth-child(odd){background:oklch(0.985 0.002 95)}\n.hist li .meta{white-space:nowrap}\n.filters{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:-2px 0 12px}\n.fsel .input{height:36px;font-size:var(--t-sm);min-width:150px;transition:background var(--fast) var(--ease),border-color var(--fast) var(--ease)}\n.fsel.on .input{background-color:oklch(0.6 0.11 185 / .1);border-color:oklch(0.6 0.11 185 / .55);box-shadow:inset 0 -2px 0 var(--teal);color:var(--ink);font-weight:600}\n.ftog{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 12px 0 8px;border:1px solid var(--line);border-radius:var(--r-ctl);font-size:var(--t-sm);font-weight:500;color:var(--ink2);cursor:pointer;background:var(--bg)}\n.ftog .switch{transform:scale(.8)}\n.ftog.on{background:oklch(0.6 0.11 185 / .1);border-color:oklch(0.6 0.11 185 / .55);color:var(--ink);font-weight:600;box-shadow:inset 0 -2px 0 var(--teal)}\n.ftog.on .switch input:checked+i{background:var(--teal)}\n.fclear{color:var(--teal);font-size:var(--t-sm);margin-left:4px}\n.fempty{padding:20px!important;color:var(--ink2);font-size:var(--t-sm);text-align:center}\n.chipsub{font-weight:500;opacity:.85}\n.req{font-style:normal;font-weight:600;font-size:11px;color:var(--amberink);margin-left:6px}\n.doctag{display:inline-flex;margin-left:8px;border-radius:var(--r-pill);padding:1px 8px;font-size:11px;font-weight:600;background:oklch(0.6 0.15 255 / .12);color:oklch(0.45 0.13 255);vertical-align:1px}\n.amberchip{background:oklch(0.6 0.14 65 / .14);color:var(--amberink)}\n.warnline{display:flex;align-items:center;gap:6px;margin-top:4px;font-size:var(--t-xs);font-weight:600;color:var(--amberink)}\n.hilink{display:inline-flex;align-items:center;gap:6px;margin-top:4px;border:0;border-radius:8px;background:oklch(0.6 0.11 185 / .12);color:oklch(0.42 0.09 185);font-size:var(--t-xs);font-weight:600;height:28px;padding:0 10px;position:relative}\n.hilink::after{content:\"\";position:absolute;inset:-8px -2px}\n.hilink:hover{background:oklch(0.6 0.11 185 / .2)}\n.tsend{flex-basis:100%;margin:-6px 0 0 28px;font-size:11px;font-weight:500;color:var(--ink2)}\n.tsend b{color:var(--ink);font-weight:600}\n.hosec{grid-column:1 / -1;margin:10px 0 -2px;padding-top:12px;border-top:1px solid var(--line-2);font-size:var(--t-sm);font-weight:600;color:var(--ink)}\n.secopt{font-style:normal;font-weight:500;font-size:var(--t-xs);color:var(--muted);margin-left:6px}\n.hosec:first-child{margin-top:0;padding-top:0;border-top:0}\n.hoview h6{margin:14px 0 6px;font-size:var(--t-xs);font-weight:600;color:var(--ink2)}\n.hoview h6:first-child{margin-top:0}\n.feeset{display:flex;flex-direction:column;gap:4px}\n.hoform .feeset label.furnopt{display:flex;align-items:center;flex-wrap:wrap;gap:10px;font-size:var(--t-sm)}\n.hoform .feeset label.furnopt input[type=radio]{margin:0}\n.feeset .furnopt{align-items:center;flex-wrap:wrap}\n.feein{display:inline-flex;align-items:center;gap:6px;margin-left:8px;font-size:var(--t-xs);color:var(--ink2)}\n.feein .input{height:34px;width:180px}\n.tierb{display:inline-flex;border-radius:var(--r-pill);padding:1px 7px;font-size:11px;font-weight:600;background:oklch(0.6 0.015 270 / .14);color:var(--ink2);margin-left:4px;white-space:nowrap}\n.facts h6{margin:12px 0 6px;padding-top:10px;border-top:1px solid var(--line-2);font-size:var(--t-xs);font-weight:600;color:var(--ink2)}\n.facts dt.wide,.facts dd.wide{grid-column:1 / -1;text-align:left}\n.facts dd.wide{margin-top:-4px;font-weight:500}\n.fsec{grid-column:1 / -1;font-size:var(--t-md);font-weight:600;margin:8px 0 -4px;padding-top:14px;border-top:1px solid var(--line-2)}\n.lines{border:1px solid var(--line-2);border-radius:12px;overflow:hidden}\n.lines h5{margin:0;padding:12px 14px;font-size:var(--t-sm);font-weight:600;color:var(--ink);display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:var(--panel)}\n.lines h5 .meta{font-weight:500;margin-left:auto}\n.llist{list-style:none;margin:0;padding:0}\n.lrow{display:grid;gap:10px;align-items:center;padding:8px 14px;border-top:1px solid var(--line-2);min-height:54px;font-size:var(--t-sm)}\n.lrow.m-plan{grid-template-columns:minmax(0,1fr) 110px 40px}\n.lrow.m-approve{grid-template-columns:minmax(0,1fr) 96px 140px 190px}\n.lrow.m-orders{grid-template-columns:minmax(0,1fr) 96px 240px}\n.lrow.lhead{min-height:0;padding-top:7px;padding-bottom:7px;font-size:var(--t-xs);font-weight:600;color:var(--muted)}\n.lrow .li b,.lrow .lp b{display:block;color:var(--ink);font-weight:600}\n.lrow .li{min-width:0}\n.lrow .li b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.lrow.declined .li b,.lrow.declined .lp b{text-decoration:line-through;color:var(--muted)}\n.lpair{display:flex;gap:6px}\n.lchip{display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 10px;border-radius:var(--r-pill);border:1px solid transparent;font-size:var(--t-xs);font-weight:600;position:relative;white-space:nowrap}\n.lchip::after{content:\"\";position:absolute;inset:-6px -2px}\n.lchip.ok{background:oklch(0.6 0.13 155 / .14);color:oklch(0.42 0.1 155)}\n.lchip.no{background:oklch(0.6 0.19 25 / .12);color:var(--redink)}\n.lchip:hover{filter:brightness(.97)}\n.lchip:active{transform:scale(.97)}\n.ld .input{width:100%;height:36px}\n.lbudget{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:12px 14px;border-top:1px solid var(--line);background:var(--panel)}\n.lbudget b{display:block;color:var(--ink);font-size:var(--t-base)}\n.lempty{padding:14px;color:var(--ink2);font-size:var(--t-sm);border-top:1px solid var(--line-2)}\n.lineadd{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr) 64px 104px auto;gap:8px;padding:10px 14px;border-top:1px solid var(--line-2)}\n.lineadd .input{height:36px;font-size:var(--t-sm)}\n.mweek{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;padding:8px 8px 4px}\n.mweek button{border:0;background:none;border-radius:10px;height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font-size:10.5px;font-weight:500;color:var(--muted);position:relative;transition:background var(--fast) var(--ease)}\n.mweek button:hover{background:var(--hover)}\n.mweek button b{font-size:var(--t-sm);color:var(--ink);font-weight:600}\n.mweek button.sel{background:var(--ink);color:#fff}\n.mweek button.sel b{color:#fff}\n.mweek button.today:not(.sel) b{text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:2px}\n.mweek .has{width:4px;height:4px;border-radius:50%;background:currentColor;opacity:.7}\n.mlist{list-style:none;margin:0;padding:4px 6px}\n.mlist button{display:flex;align-items:center;gap:10px;width:100%;border:0;background:none;text-align:left;border-radius:10px;padding:6px 8px;min-height:48px;transition:background var(--fast) var(--ease)}\n.mlist button:hover{background:var(--hover)}\n.mlist button:active{background:var(--press)}\n.mlist .bar{width:3px;align-self:stretch;border-radius:3px;flex:none}\n.mlist .t{flex:1;min-width:0}\n.mlist .t b{display:block;font-size:var(--t-sm);font-weight:600;color:var(--ink);white-space:normal;overflow:visible;text-overflow:unset;overflow-wrap:anywhere;line-height:1.35}\n.mlist .t span{display:block;font-size:var(--t-xs);font-weight:500;color:var(--ink2);white-space:normal;overflow:visible;text-overflow:unset;overflow-wrap:anywhere;line-height:1.35}\n.mlist .empty{padding:12px 8px;font-size:var(--t-sm);color:var(--ink2)}\n.mfootlink{padding:2px 14px 10px}\n.dgrid{display:grid;grid-template-columns:minmax(0,1fr) 230px;gap:16px;align-items:start}\n.tasks{list-style:none;margin:0;padding:0}\n.tasks li{display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--line-2);font-size:var(--t-sm);color:var(--ink)}\n.tasks li:last-child{border-bottom:0}\n.tasks label{flex:1;display:flex;align-items:center;gap:10px;cursor:pointer;min-width:0;min-height:44px;padding:4px 0}\n.tasks input[type=checkbox]{-webkit-appearance:none;appearance:none;width:20px;height:20px;flex:none;margin:0;cursor:pointer;position:relative;\n  border-radius:6px;border:1.5px solid rgb(0 0 0 / .28);background:var(--bg) no-repeat center / 14px 14px;\n  transition:background-color var(--fast) var(--ease),border-color var(--fast) var(--ease),box-shadow var(--fast) var(--ease)}\n.tasks input[type=checkbox]::after{content:\"\";position:absolute;inset:-12px}\n.tasks label:hover input[type=checkbox]:not(:checked){border-color:rgb(0 0 0 / .38);background-color:var(--panel)}\n.tasks input[type=checkbox]:checked{background-color:var(--ink);border-color:transparent;\n  background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m5 12.5 4.5 4.5L19 7.5'/%3E%3C/svg%3E\")}\n.tasks input[type=checkbox]:focus-visible{outline:none;box-shadow:0 0 0 3px oklch(0.6 0.15 255 / .25)}\n.tasks input[type=checkbox]:active{transform:scale(.92)}\n.tasks li.done .tn{color:var(--muted);text-decoration:line-through}\n.tasks .tdue{font-size:var(--t-xs);font-weight:500;color:var(--ink2);min-width:52px;text-align:right}\n.tasks .tdue.late{color:var(--redink);font-weight:600}\n.owntag{font-size:11px;font-weight:600;color:var(--ink2);background:var(--panel);border:1px solid var(--line-2);border-radius:var(--r-pill);padding:1px 8px;white-space:nowrap}\n.facts{background:var(--panel);border-radius:12px;padding:12px 14px;font-size:var(--t-sm);align-self:start}\n.facts dl{margin:0;display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px 14px;align-items:baseline}\n.facts dt{color:var(--muted);font-weight:500;padding-right:4px}\n.facts dd{margin:0;text-align:right;font-weight:500;color:var(--ink);min-width:0;overflow-wrap:anywhere}\n.inline-field{display:flex;align-items:center;gap:10px;font-size:var(--t-sm);font-weight:500;color:var(--ink2)}\n.input{border:1px solid var(--line);border-radius:var(--r-ctl);padding:0 12px;height:40px;font-size:var(--t-sm);background:var(--bg);min-width:0;transition:border-color var(--fast) var(--ease)}\nselect.input{-webkit-appearance:none;appearance:none;padding-right:34px;text-overflow:ellipsis;white-space:nowrap;overflow:hidden;cursor:pointer;\n  background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2352525b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\");\n  background-repeat:no-repeat;background-position:right 11px center;background-size:16px 16px}\nselect.input::-ms-expand{display:none}\n.input:focus{outline:none;border-color:oklch(0.6 0.15 255 / .6);box-shadow:0 0 0 3px oklch(0.6 0.15 255 / .12)}\n.note{flex:1}\n.notes{margin:0;padding:0;list-style:none;font-size:var(--t-sm);color:var(--ink2);display:flex;flex-direction:column;gap:6px}\n.notes li{display:flex;gap:8px;align-items:center}\n.assignbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:var(--goldtint);border:1px solid oklch(0.72 0.095 85 / .3);border-radius:12px;padding:10px 12px;font-size:var(--t-sm);color:var(--ink)}\n.assignbar .input{height:36px}\n.hint{font-size:var(--t-xs);font-weight:500;color:var(--muted);margin-top:5px;display:flex;align-items:center;gap:5px;min-height:18px}\n.hint.good{color:oklch(0.42 0.1 155)}\n.hint.bad{color:var(--redink)}\n\n/* mobile cards */\n.mcards{display:none;flex-direction:column;gap:10px}\n.mcard{overflow:hidden}\n.mcard .mtap{display:block;width:100%;text-align:left;border:0;background:none;padding:14px 16px;transition:background var(--fast) var(--ease)}\n.mcard .mtap:active{background:var(--press)}\n.mcard .top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}\n.mcard .chips{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}\n.mcard .row3{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:var(--t-sm);color:var(--ink);font-weight:500;flex-wrap:wrap}\n.mcard.landed{animation:land 600ms var(--ease)}\n.mcard .dwrap{border-radius:0;border:0;border-top:1px solid var(--line-2)}\n\n/* =========================================================\n   Schedule\n   ========================================================= */\n.weeknav{display:flex;align-items:center;gap:4px}\n.weeknav .lbl{font-size:var(--t-sm);font-weight:600;color:var(--ink);min-width:140px;text-align:center}\n.schedscroll{overflow-x:auto;-webkit-overflow-scrolling:touch}.schedscroll .grid,.sched .days{min-width:980px}\n.sgrid{min-width:1100px}\n.srow{display:grid;grid-template-columns:168px repeat(7,minmax(120px,1fr));border-bottom:1px solid var(--line-2)}\n.srow:last-child{border-bottom:0}\n.srow.flash .member{animation:land 700ms var(--ease)}\n.dayh{padding:10px 6px;text-align:center;font-size:var(--t-xs);font-weight:500;color:var(--muted)}\n.dayh b{display:grid;place-items:center;width:32px;height:32px;margin:2px auto 0;border-radius:50%;font-size:var(--t-base);color:var(--ink);font-weight:600}\n.dayh.today b{background:var(--ink);color:#fff}\n.member{display:flex;align-items:center;gap:10px;padding:12px 14px;border-right:1px solid var(--line-2);font-size:var(--t-sm);font-weight:600;color:var(--ink);min-width:0}\n.member > div{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.member small{display:block;font-weight:500;color:var(--muted);font-size:var(--t-xs);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.bgcell{border-left:1px solid var(--line-2)}\n.bgcell.today{background:oklch(0.985 0.002 95)}\n.schip{position:relative;z-index:1;margin:6px 5px;border-radius:9px;padding:6px 10px;font-size:var(--t-xs);border:0;text-align:left;line-height:1.3;border-left:3px solid;min-height:44px;height:auto;display:flex;flex-direction:column;justify-content:center;min-width:0;overflow:visible;transition:transform var(--fast) var(--ease),filter var(--fast) var(--ease)}\n.schip b{font-weight:600;display:block;white-space:normal;overflow:visible;text-overflow:unset;overflow-wrap:anywhere;line-height:1.3}\n.schip span{font-weight:500;white-space:normal;overflow:visible;text-overflow:unset;overflow-wrap:anywhere;display:block;line-height:1.3}\n.schip:hover{filter:brightness(.97)}\n.schip:active{transform:scale(.98)}\n.schip.st-Done{opacity:.6}\n.schip.st-Done b{text-decoration:line-through}\n.schip.st-Blocked{box-shadow:inset 0 0 0 1.5px var(--red)}\n.empty-week{padding:16px;color:var(--muted);font-size:var(--t-sm);font-weight:500;grid-column:2 / -1;align-self:center}\n\n/* mobile agenda */\n.agenda{display:none}\n.daystrip{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;padding:10px 8px;border-bottom:1px solid var(--line-2)}\n.daystrip button{border:0;background:none;border-radius:12px;height:58px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:11px;font-weight:500;color:var(--muted);transition:background var(--fast) var(--ease)}\n.daystrip button b{font-size:var(--t-md);color:var(--ink);font-weight:600}\n.daystrip button.sel{background:var(--ink);color:#fff}\n.daystrip button.sel b{color:#fff}\n.daystrip button .has{width:4px;height:4px;border-radius:50%;background:currentColor;opacity:.7}\n.daystrip button.today:not(.sel) b{text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:2px}\n.alist{list-style:none;margin:0;padding:6px 0}\n.alist button{display:flex;align-items:center;gap:12px;width:100%;border:0;background:none;text-align:left;padding:10px 16px;min-height:60px;transition:background var(--fast) var(--ease)}\n.alist button:active{background:var(--press)}\n.alist .bar{width:4px;align-self:stretch;border-radius:4px;flex:none}\n.alist .t{flex:1;min-width:0}\n.alist .t b{display:block;color:var(--ink);font-weight:600;font-size:var(--t-base)}\n\n/* =========================================================\n   Overlays — the only frosted surfaces\n   ========================================================= */\n.frost{background:rgb(255 255 255 / .8);-webkit-backdrop-filter:blur(22px) saturate(1.5);backdrop-filter:blur(22px) saturate(1.5);border:1px solid var(--line);box-shadow:0 12px 40px rgb(0 0 0 / .12)}\n.scrim{position:fixed;inset:0;background:rgb(20 20 25 / .2);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);z-index:80;display:flex;opacity:0;visibility:hidden;transition:opacity var(--med) var(--ease),visibility 0s linear var(--med)}\n.scrim.show{opacity:1;visibility:visible;transition:opacity var(--med) var(--ease)}\n.scrim>.sheet{transform:translateY(8px) scale(.985);transition:transform var(--med) var(--ease)}\n.scrim.show>.sheet{transform:none}\n\n/* popover */\n.pop{position:fixed;z-index:70;width:316px;border-radius:16px;padding:16px;opacity:0;transform:translateY(4px);transition:opacity var(--fast) var(--ease),transform var(--fast) var(--ease)}\n.pop.show{opacity:1;transform:none}\n.pop h5{margin:0 0 2px;font-size:var(--t-md);font-weight:600;color:var(--ink);padding-right:40px}\n.pop .sub{color:var(--ink2);font-size:var(--t-sm);margin-bottom:14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}\n.pop .row2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}\n.pop label.l{font-size:var(--t-xs);font-weight:600;color:var(--ink2);display:block;margin-bottom:5px}\n.pop .input{width:100%;height:40px}\n.stchips{display:flex;gap:6px;flex-wrap:wrap}\n.stchips button{border:1px solid var(--line);background:var(--bg);border-radius:var(--r-pill);height:36px;padding:0 12px;font-size:var(--t-xs);font-weight:500;color:var(--ink2);transition:background var(--fast) var(--ease)}\n.stchips button:active{transform:scale(.97)}\n.stchips button.on{border-color:transparent;font-weight:600}\n.pop .x{position:absolute;right:8px;top:8px}\n\n/* modal: outer 20 / pad 24 */\n.scrim.center{align-items:center;justify-content:center;padding:20px}\n.modal{width:100%;max-width:540px;max-height:calc(100dvh - 40px);overflow:auto;border-radius:20px;padding:24px}\n.modal h2{font-size:20px;font-weight:650;line-height:1.3}\n.modal .lede{color:var(--ink2);font-size:var(--t-sm);margin:4px 0 20px}\n.fgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px 14px}\n.fgrid .full{grid-column:1 / -1}\n.field label{display:block;font-size:var(--t-sm);font-weight:600;color:var(--ink);margin-bottom:6px}\n.field label em{font-style:normal;font-weight:500;color:var(--muted)}\n.field .input,.field select.input,.field textarea.input{width:100%;font-size:var(--t-base)}\n.field textarea.input{height:auto;min-height:76px;padding:10px 12px;resize:vertical}\n.field.err .input{border-color:var(--red)}\n.tog{display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--panel);border-radius:12px;padding:12px 14px;min-height:56px}\n.tog b{font-size:var(--t-sm);font-weight:600;color:var(--ink);display:block}\n.tog small{color:var(--ink2);font-size:var(--t-xs);font-weight:500}\n.switch{position:relative;width:44px;height:26px;flex:none}\n.switch input{opacity:0;position:absolute;inset:-9px;margin:0;cursor:pointer;z-index:1;width:auto;height:auto}\n.switch i{position:absolute;inset:0;border-radius:var(--r-pill);background:oklch(0.82 0.005 285);transition:background var(--med) var(--ease)}\n.switch i::after{content:\"\";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgb(0 0 0 / .2);transition:transform var(--med) var(--ease)}\n.switch input:checked+i{background:var(--ink)}\n.switch input:checked+i::after{transform:translateX(18px)}\n.switch input:disabled{cursor:not-allowed}\n.tog.disabled b,.tog.disabled .switch{opacity:.5}\n.mfoot{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}\n\n/* command palette: outer 18 / pad 8 → items 10 */\n.scrim.top{align-items:flex-start;justify-content:center;padding:12dvh 16px 16px}\n.cmdk{width:100%;max-width:600px;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;max-height:70dvh}\n.cmdk .q{display:flex;align-items:center;gap:10px;padding:0 16px;border-bottom:1px solid var(--line-2)}\n.cmdk .q input{flex:1;border:0;background:none;height:54px;font-size:var(--t-md);color:var(--ink);outline:none;min-width:0}\n.cmdk .res{overflow-y:auto;padding:8px}\n.cmdk .grp{font-size:var(--t-xs);font-weight:600;color:var(--muted);padding:10px 10px 4px}\n.cmdk .it{display:flex;align-items:center;gap:12px;width:100%;border:0;background:none;text-align:left;border-radius:10px;padding:0 10px;min-height:46px;color:var(--ink);font-size:var(--t-base);font-weight:500}\n.cmdk .it .s{color:var(--muted);font-size:var(--t-sm);font-weight:500;margin-left:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:55%}\n.cmdk .it.act{background:var(--press)}\n.cmdk .it .ico{width:28px;height:28px;border-radius:8px;background:var(--bg);border:1px solid var(--line-2);display:grid;place-items:center;flex:none;color:var(--ink2)}\n.cmdk .empty{padding:28px;text-align:center;color:var(--ink2);font-size:var(--t-sm)}\n.cmdk .foot{display:flex;gap:14px;padding:10px 16px;border-top:1px solid var(--line-2);font-size:var(--t-xs);color:var(--ink2);font-weight:500}\n.cmdk .foot span{display:flex;align-items:center;gap:5px}\n\n/* date field + branded calendar */\n.datefield{position:relative;display:flex;min-width:0}\n.datefield .input{width:100%;padding-right:42px}\n.advrow .field .datefield{width:190px}\n.advrow .field .datefield .input{width:100%}\n.dfbtn{position:absolute;right:4px;top:50%;transform:translateY(-50%);width:32px;height:32px;border:0;border-radius:8px;background:none;color:var(--ink2);display:grid;place-items:center;transition:background var(--fast) var(--ease)}\n.dfbtn::after{content:\"\";position:absolute;inset:-6px}\n.dfbtn:hover{background:var(--hover);color:var(--ink)}\n.dfbtn:active{background:var(--press)}\n.dp{position:fixed;z-index:95;width:296px;border-radius:16px;padding:10px;opacity:0;transform:translateY(4px);transition:opacity var(--fast) var(--ease),transform var(--fast) var(--ease)}\n.dp.show{opacity:1;transform:none}\n.dphead{display:flex;align-items:center;justify-content:space-between;padding:0 0 6px}\n.dphead b{font-size:var(--t-sm);font-weight:600;color:var(--ink)}\n.dpgrid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}\n.dpwd span{text-align:center;font-size:11px;font-weight:600;color:var(--muted);padding:4px 0}\n.dpgrid button{height:36px;border:0;border-radius:10px;background:none;font-size:var(--t-sm);font-weight:500;color:var(--ink);font-variant-numeric:tabular-nums;position:relative;transition:background var(--fast) var(--ease)}\n.dpgrid button:hover{background:var(--hover)}\n.dpgrid button:active{background:var(--press)}\n.dpgrid button.we{color:var(--ink2)}\n.dpgrid button.out{color:oklch(0.62 0.006 285)}\n.dpgrid button.today{font-weight:700}\n.dpgrid button.today::after{content:\"\";position:absolute;left:50%;bottom:5px;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:currentColor}\n.dpgrid button.sel{background:var(--ink);color:#fff;font-weight:600}\n.dpfoot{display:flex;gap:6px;padding-top:8px;margin-top:6px;border-top:1px solid var(--line-2)}\n.dpfoot .btn{flex:1;padding:0 6px}\n\n/* pdf viewer: outer 20 */\n.viewer{width:min(960px,100%);height:min(86dvh,1100px);border-radius:20px;display:flex;flex-direction:column;overflow:hidden;padding:0}\n.vhead{display:flex;align-items:center;gap:12px;padding:10px 10px 10px 18px;border-bottom:1px solid var(--line-2);min-height:60px}\n.vhead .vt{flex:1;min-width:0;display:flex;flex-direction:column}\n.vhead .vt b{color:var(--ink);font-weight:600;font-size:var(--t-base);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.viewer iframe{flex:1;width:100%;border:0;background:var(--panel)}\n\n/* =========================================================\n   Right panel (activity)\n   ========================================================= */\n.rcard .cardhead{min-height:54px;padding:12px 14px}\n.rlist{padding:4px 14px 8px}\n.upitem{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--line-2);align-items:center}\n.upitem:last-child{border-bottom:0}\n.upitem .t{flex:1;min-width:0;font-size:var(--t-sm)}\n.upitem .t b{display:block;font-weight:600;color:var(--ink)}\n.upitem .t span{color:var(--ink2);font-size:var(--t-xs);font-weight:500}\n.upitem.done .t b{color:var(--muted);font-weight:500}\n.tm{display:flex;align-items:center;gap:10px;padding:8px 0;min-height:48px}\n.tm .t{flex:1;min-width:0;font-size:var(--t-sm)}\n.tm .t b{font-weight:600;color:var(--ink)}\n.tm .t span{display:block;color:var(--ink2);font-size:var(--t-xs);font-weight:500;white-space:normal;overflow:visible;text-overflow:unset;overflow-wrap:anywhere;line-height:1.35}\n.tm .t span.off{color:var(--muted)}\n.qa{padding:12px 14px;border-bottom:1px solid var(--line-2);display:flex;flex-direction:column;gap:10px;background:var(--panel)}\n.qa .field label{font-size:var(--t-xs);margin-bottom:4px}\n.qa .input{height:38px;font-size:var(--t-sm)}\n.qa .two{display:grid;grid-template-columns:1fr 1fr;gap:8px}\n\n.placeholder{padding:56px 24px;text-align:center;color:var(--ink2)}\n.placeholder b{display:block;color:var(--ink);font-size:var(--t-md);font-weight:600;margin-bottom:4px}\n\n.toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,10px);background:var(--ink);color:#fff;border-radius:12px;padding:0 16px;height:44px;font-size:var(--t-sm);font-weight:500;opacity:0;pointer-events:none;transition:opacity var(--med) var(--ease),transform var(--med) var(--ease);z-index:100;display:flex;align-items:center;gap:8px;white-space:nowrap}\n.toast.show{opacity:1;transform:translate(-50%,0)}\n\n.bottomnav,.fab{display:none}\n\n/* =========================================================\n   Responsive\n   ========================================================= */\n@media (max-width:1180px){ .dgrid{grid-template-columns:1fr} }\n@media (max-width:1279px){\n  .app{--sw:208px;grid-template-columns:var(--sw) minmax(0,1fr) 272px}\n  main{padding:24px 24px 40px}\n  .right{padding:20px 12px}\n}\n@media (max-width:1023px){\n  .app{--sw:232px;grid-template-columns:var(--sw) minmax(0,1fr)}\n  .right{grid-column:2;position:static;height:auto;border-left:0;border-top:1px solid var(--line);padding:24px 32px 40px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}\n  .right .rcard:first-child{grid-row:span 2}\n}\n@media (max-width:1023px){ .stats{grid-template-columns:repeat(2,minmax(0,1fr))} .stat:nth-child(3){box-shadow:none} }\n@media (max-width:767px){\n  :host{height:auto;min-height:100dvh;overflow:visible}\n  .app{display:block;height:auto;min-height:100dvh;overflow:visible}\n  .side{display:none}\n  main{height:auto;overflow:visible;padding:0 16px 24px}\n  .mtop{display:flex;align-items:center;justify-content:space-between;gap:8px;height:calc(60px + var(--safe-t));padding:var(--safe-t) 16px 0;margin:0 -16px 16px;position:sticky;top:0;background:rgb(255 255 255 / .96);border-bottom:1px solid var(--line-2);z-index:30}\n  .mtop .brand{padding:0}\n  .mtop .iconbtn{width:44px;height:44px}\n  .head{margin-bottom:16px}\n  .head .cta-add{display:none}\n  .head h1{font-size:22px}\n  .stats{margin-bottom:24px}\n  .stat{padding:10px}\n  .stat .ic{width:32px;height:32px}\n  .tablebox{display:none}\n  #pipeCard{border:0;background:none}\n  .mcards{display:flex}\n  .secbar{flex-direction:column;align-items:stretch}\n  .seg{display:grid;grid-template-columns:1fr 1fr}\n  .seg button{height:38px}\n  .sched-desktop{display:none}\n  .agenda{display:block}\n  .phase{flex-basis:100%}\n  .dhead{flex-direction:column;align-items:stretch}\n  .dacts{display:grid;grid-template-columns:1fr 1fr}\n  .dacts .btn{height:44px}\n  .btn{height:44px}\n  .btn.sm{height:40px}\n  .iconbtn{width:44px;height:44px}\n  .input{height:44px;font-size:16px}\n  .tasks label{min-height:48px}\n  .right{display:flex;align-items:stretch;padding:8px 16px calc(150px + var(--safe-b));background:var(--bg);border-top:0}\n  .right::before{content:\"Activity\";font-size:var(--t-md);font-weight:600;color:var(--ink)}\n  .bottomnav{display:flex;position:fixed;left:0;right:0;bottom:0;background:rgb(255 255 255 / .96);border-top:1px solid var(--line);z-index:50;padding:4px 6px calc(4px + var(--safe-b))}\n  .bottomnav button{flex:1;border:0;background:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:11px;font-weight:500;color:var(--ink2);min-height:52px;border-radius:12px;transition:background var(--fast) var(--ease)}\n  .bottomnav button:active{background:var(--press)}\n  .bottomnav button.active{color:var(--ink);font-weight:600}\n  .bottomnav button.active{background:rgb(0 0 0 / .045);box-shadow:inset 0 0 0 1px rgb(0 0 0 / .1)}\n  .bottomnav button.active svg.i{color:var(--ink);stroke-width:2.1}\n  .fab{display:inline-flex;position:fixed;right:16px;bottom:calc(72px + var(--safe-b));z-index:55;height:52px;padding:0 20px;border-radius:var(--r-pill);font-size:var(--t-base);box-shadow:0 6px 20px rgb(0 0 0 / .18)}\n  .scrim.center{align-items:flex-end;padding:0}\n  .modal{max-width:none;border-radius:20px 20px 0 0;max-height:94dvh;padding:20px 18px calc(20px + var(--safe-b))}\n  .modal .mfoot{position:sticky;bottom:calc(-20px - var(--safe-b));margin:20px -18px calc(-20px - var(--safe-b));padding:12px 18px calc(12px + var(--safe-b));background:rgb(255 255 255 / .92);border-top:1px solid var(--line-2)}\n  .modal .mfoot .btn{flex:1;height:48px}\n  .scrim>.sheet{transform:translateY(24px)}\n  .fgrid{grid-template-columns:1fr}\n  .pop{left:0!important;right:0;top:auto!important;bottom:0;width:auto;border-radius:20px 20px 0 0;padding:20px 18px calc(20px + var(--safe-b))}\n  .scrim.top{padding:calc(12px + var(--safe-t)) 10px 10px}\n  .cmdk .foot{display:none}\n  .toast{bottom:calc(136px + var(--safe-b))}\n  .dp{left:0!important;right:0;top:auto!important;bottom:0;width:auto;border-radius:20px 20px 0 0;padding:14px 14px calc(14px + var(--safe-b))}\n  .dpgrid button{height:44px}\n  .dpfoot .btn{height:44px}\n  .advrow .field .datefield{width:100%}\n  .viewer{height:100dvh;border-radius:0}\n  #pdfScrim{align-items:stretch}\n  .doclist .btn[data-act=docDown]{display:none}\n  .lrow.m-plan,.lrow.m-approve,.lrow.m-orders{grid-template-columns:minmax(0,1fr) auto}\n  .lrow .lc,.lrow .ld{grid-column:1 / -1}\n  .lrow.lhead{display:none}\n  .fsel{flex:1 1 140px}.fsel .input{min-width:0;width:100%;height:44px}\n  .ftog{height:44px}\n  .addtask.open{grid-template-columns:1fr 1fr}\n  .addtask.open .atname,.addtask.open .atbtns{grid-column:1 / -1}\n  .addtask.open .input{height:44px}\n  .hoform{grid-template-columns:1fr}\n  .hodl{grid-template-columns:1fr;gap:2px}\n  .hodl dd{margin-bottom:8px}\n  .stab{height:44px}\n  .lpair .btn{flex:1}\n  .lineadd{grid-template-columns:1fr 1fr}\n  .lineadd .input{height:44px}\n  .lineadd [data-k=lItem]{grid-column:1 / -1}\n  .lineadd .btn{grid-column:1 / -1;height:44px}\n}\n@media (prefers-reduced-motion:reduce){*{animation:none!important;transition-duration:1ms!important}}\n\n/* ---------- Entry flow: start onboarding, CRM picker, lead and sale ---------- */\n.startm{max-width:560px}\n.pathgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}\n.pathopt{display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;padding:16px;border:1px solid var(--line);border-radius:14px;background:var(--bg);min-height:150px;transition:background var(--fast) var(--ease),border-color var(--fast) var(--ease),transform var(--fast) var(--ease)}\n.pathopt:hover{background:var(--panel);border-color:rgb(0 0 0 / .2)}\n.pathopt:active{transform:scale(.98)}\n.pathopt .pico{width:36px;height:36px;border-radius:10px;background:var(--panel);display:grid;place-items:center;margin-bottom:6px;color:var(--ink)}\n.pathopt b{font-size:var(--t-md);font-weight:600;color:var(--ink)}\n.pathopt span:not(.pico){font-size:var(--t-sm);color:var(--ink2)}\n.pathopt em{margin-top:auto;padding-top:8px;font-style:normal;font-size:var(--t-xs);font-weight:600;color:oklch(0.42 0.09 185)}\n.pickm{max-width:760px}\n.pksearch{margin-bottom:6px}\n.picklist{display:flex;flex-direction:column;gap:6px}\n.picklist ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}\n.pgh{margin:10px 0 2px;font-size:var(--t-xs);font-weight:600;color:var(--ink2);display:flex;align-items:center;gap:6px}\n.pick{border:1px solid var(--line);border-radius:14px;padding:12px 14px;background:var(--bg)}\n.pick.off{opacity:.65}\n.pick .ptop{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}\n.pgrid{margin:10px 0 0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px 14px}\n.pgrid dt{font-size:11px;font-weight:600;color:var(--muted)}\n.pgrid dd{margin:0;font-size:var(--t-sm);font-weight:500;color:var(--ink);overflow-wrap:anywhere;min-width:0}\n.pgrid dd .chip{white-space:normal}\n.pact{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid var(--line-2)}\n.mfoot.spread{justify-content:space-between;align-items:center}\n.gaptext{color:var(--amberink);font-weight:600;font-size:var(--t-xs)}\n.gap{display:inline-flex;margin-left:6px;border-radius:var(--r-pill);padding:1px 8px;font-size:11px;font-weight:600;background:oklch(0.6 0.14 65 / .14);color:var(--amberink);vertical-align:1px}\n.field.isgap .input,.isgap{box-shadow:0 0 0 2px oklch(0.6 0.14 65 / .35)}\n.field.err .input{border-color:var(--red)}\n.srcbanner{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:-8px 0 16px;padding:10px 12px;border-radius:12px;background:var(--panel)}\n.srcbanner .sbl{display:flex;gap:10px;align-items:flex-start}\n.srcbanner .sbl>svg{margin-top:2px}\n.srcbanner b{display:block;color:var(--ink);font-size:var(--t-sm)}\n.cwarn{margin-top:6px;display:flex;flex-direction:column;gap:4px;padding:10px 12px;border-radius:10px;background:oklch(0.6 0.14 65 / .12);color:var(--ink);font-size:var(--t-sm)}\n.cwarn b{color:var(--amberink)}\n.cconfirm{display:flex;align-items:center;gap:8px;margin-top:4px;font-weight:600;cursor:pointer;min-height:36px}\n.cconfirm input{width:18px;height:18px;accent-color:var(--ink)}\n@keyframes shake{0%,100%{transform:none}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}\n.cwarn.shake{animation:shake var(--slow) var(--ease);box-shadow:0 0 0 2px oklch(0.6 0.14 65 / .5)}\n#fFeeSet label.furnopt{align-items:center;flex-wrap:wrap;gap:10px}\n#fFeeSet label.furnopt input[type=radio]{margin:0}\n.crmopt{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:12px;border:1px solid oklch(0.6 0.11 185 / .4);background:oklch(0.6 0.11 185 / .07);cursor:pointer}\n.crmopt input{width:18px;height:18px;margin-top:2px;accent-color:var(--teal);flex:none}\n.crmopt b{display:block;color:var(--ink);font-size:var(--t-sm)}\n.crmopt span{font-size:var(--t-xs);color:var(--ink2)}\n.fsec .gap{font-size:11px}\n.leadgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}\n.leadgrid h6{margin:0 0 6px;font-size:var(--t-xs);font-weight:600;color:var(--ink2)}\n.leadgrid .hodl{grid-template-columns:90px minmax(0,1fr)}\n.leadgrid .hodl dd{overflow-wrap:anywhere;min-width:0}\n.leadgrid>div{min-width:0}\n.leadgrid .added{background:var(--panel);border-radius:12px;padding:10px 12px}\n.leadnote{font-size:var(--t-sm);color:var(--ink)}\n.linkbtn.tl{color:oklch(0.42 0.09 185);text-decoration:none;font-weight:600}\n.linkbtn.tl:hover{text-decoration:underline}\n.onbtxt{font-weight:500;color:var(--ink)}\n.crmsearch .input{min-width:260px}\n@media (max-width:1180px){ .leadgrid{grid-template-columns:1fr 1fr} .pgrid{grid-template-columns:repeat(3,minmax(0,1fr))} }\n@media (max-width:767px){\n  .pathgrid{grid-template-columns:1fr}\n  .pathopt{min-height:0}\n  .pgrid{grid-template-columns:1fr 1fr}\n  .leadgrid{grid-template-columns:1fr}\n  .crmsearch{flex:1 1 100%}.crmsearch .input{min-width:0}\n  .pact .btn{flex:1}\n}\n.nadash::before{content:\"\";display:block;width:10px;height:2px;margin:0 auto;border-radius:2px;background:currentColor}\n\n/* Embedded in HubShell — hide duplicate product chrome only */\n.onb.embed .side,.onb.embed .bottomnav,.onb.embed .mtop{display:none!important}\n/* Phone: the header button is hidden, so the floating Start onboarding button is the only way in. Keep it. */\n.onb.embed .app{--sw:0px;height:100%;min-height:0;overflow:hidden;grid-template-columns:minmax(0,1fr) 300px}\n/* The hub sidebar replaces Onboarding's own, so no column is reserved for it in any state (panel closed, sidebar collapsed, narrower screens). */\n@media (max-width:1279px){.onb.embed .app{grid-template-columns:minmax(0,1fr) 272px}}\n@media (min-width:1024px){:host(.rp-closed) .onb.embed .app.app{grid-template-columns:minmax(0,1fr)}}\n.onb.embed main{height:100%;min-height:0;overflow-y:auto}\n/* Line the header up with the other hub pages (date 26px from the top, title right under it). */\n@media (min-width:768px){.onb.embed main{padding-top:26px}.onb.embed .head .date{margin-bottom:0}}\n/* The search box was cut off (\"Search address or ow\"): wide enough for its placeholder on desktop. */\n@media (min-width:768px){.onb .fsel input.input{min-width:220px}}\n/* Phone inside the hub: scroll within the page (the hub owns the top bar and bottom nav), and keep the floating button above the hub's nav. */\n@media (max-width:767px){.onb.embed .app.app{height:100%;overflow-y:auto;-webkit-overflow-scrolling:touch}.onb.embed main{height:auto;overflow:visible;padding-top:14px}.onb.embed .head .date{display:none}.onb.embed .fab{bottom:calc(88px + var(--safe-b))}}\n.onb.embed .right{height:100%;min-height:0}\n@media (max-width:1023px){.onb.embed .app.app{grid-template-columns:minmax(0,1fr)} .onb.embed .right{grid-column:1}}\n:host{height:100%;min-height:0}"

const WA_WELCOME_CSS = `
.wawelcome{margin:4px 0 2px;padding:14px 14px 16px;background:#fff;border:1px solid var(--line);border-radius:12px}
.wawelcome .wahead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px}
.wawelcome .wahead h5{margin:0;font-size:var(--t-md);font-weight:650;color:var(--ink)}
.wawelcome .wasub{margin:4px 0 0;font-size:var(--t-xs);font-weight:500;color:var(--muted);line-height:1.45}
.wawelcome .wabox{background:#fff;border:1px solid #e8e8e3;border-radius:8px;padding:16px;font-size:14px;line-height:1.6;color:var(--ink2);white-space:pre-wrap;margin:0 0 12px}
.wawelcome .wanote{margin:0 0 10px;font-size:var(--t-xs);font-weight:500;color:var(--muted)}
.wawelcome .wacopy{width:100%}
`;

const AUDIT_CSS = `
.audit-nl{display:flex;gap:12px;align-items:flex-start;padding:12px 16px;border-radius:8px;background:#fff8e6;border:1px solid #f0c060;margin:0 0 10px}
.audit-nl b{display:block;color:var(--ink);font-size:14px;font-weight:600}
.audit-nl p{margin:4px 0 10px;font-size:13px;color:var(--muted)}
.audit-nl .btn.amber{background:#f0c060;border-color:transparent;color:#2a1d00;font-weight:600}
.audit-ln{display:flex;align-items:center;gap:8px;min-height:40px;font-size:13px;color:var(--ink2);border-bottom:1px solid #f0f0ee;margin-bottom:8px}
.audit-ln b{color:var(--ink);font-weight:600}
.audit-ln .dot8{width:8px;height:8px;border-radius:50%;background:oklch(0.6 0.13 155);box-shadow:0 0 0 3px oklch(0.6 0.13 155 / .18);flex:none}
.audit-ln .mlink{margin-left:auto;border:0;background:none;font-size:13px;font-weight:500;color:var(--muted);padding:0;cursor:pointer}
.audit-ln .mlink:hover{color:var(--ink);text-decoration:underline}
.audit-exp{width:32px;height:32px;border-radius:8px;border:1px solid var(--line);background:#fff;display:inline-grid;place-items:center;color:var(--ink2);flex:none}
.audit-exp[aria-expanded=true] svg{transform:rotate(180deg)}
.audit-exp svg{transition:transform .2s}
.audit-pc{display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 9px;border-radius:999px;font-size:12px;font-weight:600;background:var(--panel);color:var(--muted);font-variant-numeric:tabular-nums}
.audit-pc.live{background:rgb(31 111 107 / .1);color:#1f6f6b}
.audit-pc.ok{background:oklch(0.6 0.13 155 / .14);color:oklch(0.42 0.1 155)}
.audit-panel{background:#f7f7f8;border-radius:8px;padding:16px;margin:4px 0 12px 28px}
.tasks li:has(> .audit-panel){flex-wrap:wrap}
.tasks li > .audit-panel{flex:0 0 calc(100% - 28px);min-width:0}
.audit-open{margin-top:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.audit-prow{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--ink2);flex-wrap:wrap}
.audit-prow .r{margin-left:auto;display:flex;gap:6px;align-items:center}
.audit-prow.sent{color:oklch(0.42 0.1 155)}
.audit-hr{height:1px;background:rgb(0 0 0 / .07);margin:14px 0}
.audit-plbl{display:flex;justify-content:space-between;align-items:baseline;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px}
.audit-pbar{height:4px;border-radius:999px;background:rgb(0 0 0 / .08);overflow:hidden}
.audit-pbar i{display:block;height:100%;background:#0f9d7e;border-radius:inherit}
.audit-os{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13px;color:var(--ink2)}
.audit-os .d{width:8px;height:8px;border-radius:50%;flex:none}
.audit-os .d.g{background:oklch(0.6 0.13 155)}
.audit-os .d.a{background:oklch(0.7 0.14 70)}
.audit-os .d.n{background:oklch(0.75 0.005 285)}
.audit-acts{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:4px}
.audit-acts li{display:flex;align-items:center;gap:8px;min-height:28px;font-size:13px;color:var(--ink2)}
.audit-acts .t{margin-left:auto;color:var(--muted);font-size:12px;white-space:nowrap}
.audit-acts .dot6{width:6px;height:6px;border-radius:50%;background:oklch(0.7 0.006 285)}
.audit-mrow{display:flex;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap}
.audit-chip{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 10px;border-radius:999px;font-size:12px;font-weight:600;background:#fff;border:1px solid var(--line);color:var(--ink2)}
.audit-chip.red{background:oklch(0.6 0.19 25 / .1);border-color:transparent;color:oklch(0.48 0.17 25)}
.audit-th{width:40px;height:40px;border-radius:4px;object-fit:cover;background:var(--panel);border:0;padding:0}
.audit-empty{font-size:13px;color:var(--muted)}
.audit-modal-scrim{position:fixed;inset:0;z-index:80;background:rgb(20 20 25 / .22);display:flex;align-items:flex-start;justify-content:center;padding-top:12vh}
.audit-modal{background:#fff;border:1px solid var(--line);box-shadow:0 24px 60px rgb(0 0 0 / .18);border-radius:18px;padding:22px;width:min(480px,92vw)}
.audit-modal h2{margin:0;font-size:18px;font-weight:700;color:var(--ink)}
.audit-modal .lede{font-size:14px;margin:4px 0 14px;color:var(--muted)}
.audit-res{list-style:none;margin:10px 0 0;padding:0;border:1px solid var(--line);border-radius:12px;overflow:hidden;max-height:280px;overflow-y:auto}
.audit-res li{display:flex;align-items:center;gap:12px;min-height:56px;padding:0 10px 0 14px}
.audit-res li+li{border-top:1px solid var(--line-2)}
.audit-res b{display:block;font-size:14px;color:var(--ink)}
.audit-res small{font-size:12px;color:var(--muted)}
.audit-res .btn{margin-left:auto}
`;

export const ONBOARDING_CSS = ONBOARDING_CSS_BASE + WA_WELCOME_CSS + AUDIT_CSS;

export function mountOnboarding(root, host) {
'use strict';
  root.innerHTML = "<div class=\"app\">\n  <!-- Sidebar -->\n  <aside class=\"side\" aria-label=\"Main navigation\">\n    <div class=\"brand\"><img class=\"logo\" src=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAOXElEQVR42u2dechsZR3HP7+Zea95s1y4lQsIZQUVSqiFLWTbtUVpw5IKRFuEJCXUNpJItCjLpCJMrKtiSSlmtlkSec2l/Z8W6Y80sKwgXNrU3ndmfv1xnsf7cJzzLGfOnHnOzHngct935p0z5zzPb/n+djnwwEOGFGtCv9ZpDQFGzgv7AANAa1xMan4u5Rpi/l/096zqss8thtkfcQlgClwHHA6MDSH0q1tLHSaZ9bs95xHwe+A4YDBy/vhg4KB+H9diPWB/cFXApqGQaS8BVnbZs92cRQDiHHxPAKu7Bq5q6A96zdcoAWD0q5vIP5oAZJ4L9av7EkA9psWpxnQYGiDRL7J28IyBE4CPGpt/OK8K+DXw235vO7UOi1HfsQTweENFo14CkLsTaGTMvL1jVYBGfsHEWA19zCBvF7N19U6TbcJ+zc2FnbIAUvwAvRm4ogQ5WIKp10uczCSARlCMZCoqJbcN7bIE6JoK8IGuRTi1dNUDA9LrRtYyMqQreJD9IUfu4aDBVKte73ZQog0yF589Jy+YSWJVgPQcuboYoOscKQmE2RNyaT9iXcG5i2L1EILMwDlaU8TKgrGKtE2cgzk2owsgaJavQBKeq/z5RTrLbBBnQsuewJzFoiS+rxHc5UqLEHerR3WUJYvOmcQxAfYFjqjI6V84BtCMubvqoDTiYELFEpIgknUBXDgEtszh3wQcb75nmJMrWDIU81WEoB59GiNRJKCLJUFvhw5hwxz+04CfAM/HKdpoOxgkmVoeoRKoRRGaJpRgUTMf83/Ai83hH8Ge0q2lxAK0JZ0+bigRRRuwVqquoQsmSpu29TrgRuAQQwyDZbiC25AAA0PdLwHOMUQgc0bmmkDuREQU1QMcU9PBxDn8U4EbKKqypw3o/IWCQG1IHw2ATwMXGSII1SFKA6AnRcJJ4Po6B+IXpy7vbGBXBrWYEmsGNiUdbLLiWcC3gO2GEEY1I34SQRAacAD59LlWmItSkgwayWhbwIXAZ8xeyAIPP8uEkIHDBa8HbjEIeDMB/IRs8qr3UqwCKYl2n/mokYUaClwJvL9BHFRXmklqShgLqEgaA0cBdxhsYIlAEpG6BBB7U+7ZOvtkbfz9DNg72ZF40qWkUFnATY2MGHwK8CMDijZrgEP1EEaVKgipFG3ATz8yh38ocDNFR45x22ZeaM+WHQwaOrbvLuCCCHAoEVwviRFADXgbfUQmHjPvCOBW4LkZHf5jQKAu2bc/cADiR4BrKMqaqjZMAxzq8++nRPOUsFvaZ+O/ynD+oebZcjv8rFLCxAFLbwZ2UxQ3zgKHUuJqqWH7zw2eSgCxfPgnAt8GDghV566bBNBIcPg8IzpfOgMc6gy9rsTF7WPvRwNmolYQ8CZwBnAthZ9/mvHhPyoBcov1W3B4EPBD4BQPOJRIsZ3K7eKRjOqx8c8HPu8UZg4qGjXR1ZQwWmxyMDVcdHkJHA4TgjcxJmVdZ5Oa/bP3dRlwruPgEU+XrqxUAJnnK1pweC3wBMNpowiOjhXvUrP6yGKWJwLfAd5lfh9WXNOW1/8CuK8F3CWpKiDXhE+70ScaVP30GeBQZmCCEIfrHA4ka+MfYu7p+IDVYoHgVcCru1gb2NaaBMDhkcBtwCtK4DAEAjXCL6AVnC8VZt7hFHH8IyNM1iFFEOxk9iSC5FAvIKkZQbrgmxp6ONP1HN4InOaAw4EHD8SKeKnAFbPMvGPZE8eosvGnzjVPBz7ghIOnXesPoAu8KfvaP4CvOvcxDXgOLzVcNXZ0r69DdpX4j0nsdOP4b6HI3dvfY+Nbff8Q8CbgEmAvc/1prmbgsnMDN4zJ924HLU8C4PAcA8AOqACHvpBwLMG7cfyzgG8EbHxLjPcaVXUDsM283vnKoEWHKHcAX6YInPzVAYA+cHgChefwmRFhZfVk+s7CBq6N/wmKRBafjT922rEfC/zMHP5WF0rD2hjWoBGdyIbAj4EXALc7ANAHDg83f/uaQFhZPPq9LCEGTqHGpcCHA6lsVgLtpkj0vMtIivGSnGzSVUfQxOjLe4wI3eUAQB843AF8zwCuzYrnq0rpKksGK122A980gNMXxx+bw77GEOGD5vdJ7hXFuTqCxo6t/U7DfUOnfKoKHCrwRQp3LB5w6JNC9nt3GLD3Ro/zSR0r4GLgJIrs3lHm/RR1mV3CSBhuIIaTPmnQ9D89uGDgpJ2fAXzfAw59+GATeIYx817ocHeVT38IfNAAxJGTAb1STaKW+RATA6SuN7r1Dx5cIM57x1FEFJ8TmXNo92Kn0ePP9jh43K6pp1Akem4wf41gtlaAZqAStgG/A15EEWsP4YKxOcTbKFy1mx4/vfUX7G3Ux8GOKK8y8+4zxHKlubcJ3etoIl2aGGJF8f0UGcWfcg506gGH+wHfBd5n1IFWgEOM4+Y4ChfvXjOkjJUId1Eksu7O2cZv0hGUSwm5BVwj4EMUiaSPeJxGQ8f7drGxKIYV4NBigD87nD1ywKU9/F8aG//OmoefA9aSVAmwjNRxHzhUs/lXAK80h+ZzGllweCpFksmBHs+hVR+nUAxcGDivX0+RpXSvY+N3ufGVDjra9k0dXHC7Qeu3OIenHnD4MopahCMrwKFrfZwPvN3ggS8ZS+SRDph50X0XcusPoDVxwV+M2L6kNA21Chw+1VgIJ1WAQ2t9bABXA0cD73Eqm6Yr0j5OV6Fd/MTR1acDZwaGW9i/3Q58nSLbqAocWiK4MwA4V6JZtGZwUzIHLsCohC8YXPD3gNPIcvkFhssfV2H3T5zJKrqKbeJWpS2riwtuMf6CnwecRpZA3mo+c5gHF6zsvIA2zUBp0Wl0t0HsV0c6jY424PDYhELVrquA7JNC5w0mbRoUf24gmGQJ5MkUhaqneSKKKysBpKPNn6Ui4ueacx+nyCr+twcXDJ0sn0sNltAaEcWVBoGamQqwHL1VcUhuMOk6wsEkN93svcAPgCclRBTpcrPorkkAe78XGV3vOySLC35jwOGNHlzggsOdBhccFRlRlI6125W2k0KlYeKdAMdQpJCFGky4waTXAp+NCCaNKQpRdgNvC0QU2xy8tbS5gTkCxX+Zh90FfM7J4xsGgklnA+/AH0yyTqN9gK9RxAa2MqzxWzgGaCsaqDWridVw55kUadj7elSCG0y6nCLv8E+RTqPzDKHtVaPjh3a5PFwz9gSqo7e3KLpvuplAg4DT6A6DC24KBJOGTkTRdv7YzFgSSI4JIYuWIBtOmvhthhgmnkOyuOBvBhfEBpOOMUS2s1QC1umEkFVxBI2c1mxnRDSUdGv7bDBpGsAFtvvXhR11EyfHAiRDM1ADjafUOH5ICCZtGAfQToqkj2HFAduQ8H8yTghZiazgeSqWpUZNgHUa3UyRZHKrJ/4/yHz/sjQD2x5CrXMkn94DvJyivi8mD0A6OHep9ergruCMiWPq3RvZEFq7jgHWamJmQmXStlWehtp2MKhrG9nlLCDNsU+g0A+Wzs4RJP0waNZ6drD24+D74dFNzNTpxWyfELKSKkBXWaUNVnRodK+qVqw/QK7EJV0nrkFDs/l6Pd9hR1BXwV8PSHsV0EuUtjuFyhpybdNWgPYTQ/q1tgSgvcjuth9AM9xMyYQ4ZB1AoGSYE9h7AtccA2gmKkC7mkK9jC4ebmmVOm3ctGb61rhU6DlxkjxpID0s5vqScP9j53nFeY0G08y1SQJoCgNs83znjkSJZO9pf6fer/xc+zWwkft6rn9ATYmyw3MW29uUXKOWMICl9Lspiil0xkyfh80/SczZ+wpFfx9Xqtif70zkzFn3fBXwqxK32uvfk8gc9jnPo+hLPGuo5E8b6kamOakAe1h/pGitTs3R8LMO6LIInJOS0q2le76iIXe6vd+HgI81cM+dxABD9tTXzyrA3KpZDygVqsrV0xIYFFn1/kagH8CkYkqZr2BlI8As0xqTTOdWASkX1sQbkhKA8s3mDW1i+fVJgkQpj5HTCjWnpRY0sZusFQRV/r5xCxaPLiIcXIUHpMSFvn4CGlF1JBHULJ6/lcBA6Vnzg6uegTlG00uDAHphKkBrFodqBEhUzyFrwth3jbymzODAWfMCQwQqkc+ac7VQtAqQOcVJefKmeICVeD4rM64xS0f7RHrMZ5rYSPVIEx9BaU19Ps9nFuYJnHXwUlOsV4neKnFf5mL16H7ftbWhTl/iwRVSIX18fQukLYkyaCAA4qNuiRT5saogBo+ox4GlCYetka8JcVggpe9Sa1ladawADWy+BMRV1ec1YfJ3KmFIBGeGDkwj+hHEeE1D6ixW/Gub08NDKkAiNyok9mK7kUlJzGvg0HWG5AqBX/EccJUU9KkFTdzH1hpEaM2L6xyiMeY9iaRo8ZhtEnmode5bEvBC7L2lhJ5lmYUhKaKqirPFo7vncZBoosgmAqeoZ+5wU/kD6iHohSWfjBrs0yMB33rIPJIIkzEW4KkHVEqCStJARFQjTFsCOEMjo67akAVTyw9QtTkxNq5EijCdcW0iCCOGMDWhsVQTOlojcUZdM08bAIm1wsExJp1UeOJCphoeMzIUGwhxYyzXp+b8SeT3auR1NQEXSMQ5tN4fwGcChsy/EDpXz0NrQksXqdEeRiNNVR+jSMBVriwhH3GUABZtKLdfea9hoKV9LQzwX/a0Ye9X3svmVDzcpAQ4imKu3qhmpooGAjepCD0meic13chS817q3K8GME/s3pUlwBbwrBhfR+wIlMt7xuq0SqjED6O+Opi1rkQe9c2h6ItD+7W+azQjYrWKQ5L79dgzfgwGGNXosd+vbgLCUZkABHjQ/BvPaCApCe7GVFMvxlXbRHWyzpEBTaIpRoLbu43noDQe54EyCBTgDSVQqBGpXXgCNhoRXdOEBJNUUNokIdX1NcQSfcpBN5E48iiTuxjg/l5Crp86+D9qbdaBTsRvDgAAAABJRU5ErkJggg==\" alt=\"\" width=\"34\" height=\"34\"><b>Mandel Realty</b><button class=\"iconbtn sidetog\" id=\"sideTog\" aria-label=\"Collapse sidebar\" aria-expanded=\"true\" title=\"Collapse sidebar\"><svg class=\"i sm\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2.5\"/><path d=\"M9 4v16\"/><path class=\"chv\" d=\"m15.5 10-2 2 2 2\"/></svg></button></div>\n    <button class=\"jump\" data-cmdk><svg class=\"i sm\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"6.5\"/><path d=\"m20 20-4.2-4.2\"/></svg><span class=\"nl\">Jump to…</span><kbd class=\"kbdk\">⌘K</kbd></button>\n    <div id=\"nav\"></div>\n    <div class=\"spacer\"></div>\n    <div class=\"foot nav\" id=\"navFoot\"></div>\n    <div class=\"me\" title=\"Admin · Shared account\"><span class=\"av\" id=\"meAv\">AD</span><div class=\"nl\">Admin<small>Shared account</small></div></div>\n  </aside>\n\n  <!-- Main -->\n  <main>\n    <div class=\"mtop\">\n      <div class=\"brand\"><img class=\"logo\" src=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAOXElEQVR42u2dechsZR3HP7+Zea95s1y4lQsIZQUVSqiFLWTbtUVpw5IKRFuEJCXUNpJItCjLpCJMrKtiSSlmtlkSec2l/Z8W6Y80sKwgXNrU3ndmfv1xnsf7cJzzLGfOnHnOzHngct935p0z5zzPb/n+djnwwEOGFGtCv9ZpDQFGzgv7AANAa1xMan4u5Rpi/l/096zqss8thtkfcQlgClwHHA6MDSH0q1tLHSaZ9bs95xHwe+A4YDBy/vhg4KB+H9diPWB/cFXApqGQaS8BVnbZs92cRQDiHHxPAKu7Bq5q6A96zdcoAWD0q5vIP5oAZJ4L9av7EkA9psWpxnQYGiDRL7J28IyBE4CPGpt/OK8K+DXw235vO7UOi1HfsQTweENFo14CkLsTaGTMvL1jVYBGfsHEWA19zCBvF7N19U6TbcJ+zc2FnbIAUvwAvRm4ogQ5WIKp10uczCSARlCMZCoqJbcN7bIE6JoK8IGuRTi1dNUDA9LrRtYyMqQreJD9IUfu4aDBVKte73ZQog0yF589Jy+YSWJVgPQcuboYoOscKQmE2RNyaT9iXcG5i2L1EILMwDlaU8TKgrGKtE2cgzk2owsgaJavQBKeq/z5RTrLbBBnQsuewJzFoiS+rxHc5UqLEHerR3WUJYvOmcQxAfYFjqjI6V84BtCMubvqoDTiYELFEpIgknUBXDgEtszh3wQcb75nmJMrWDIU81WEoB59GiNRJKCLJUFvhw5hwxz+04CfAM/HKdpoOxgkmVoeoRKoRRGaJpRgUTMf83/Ai83hH8Ge0q2lxAK0JZ0+bigRRRuwVqquoQsmSpu29TrgRuAQQwyDZbiC25AAA0PdLwHOMUQgc0bmmkDuREQU1QMcU9PBxDn8U4EbKKqypw3o/IWCQG1IHw2ATwMXGSII1SFKA6AnRcJJ4Po6B+IXpy7vbGBXBrWYEmsGNiUdbLLiWcC3gO2GEEY1I34SQRAacAD59LlWmItSkgwayWhbwIXAZ8xeyAIPP8uEkIHDBa8HbjEIeDMB/IRs8qr3UqwCKYl2n/mokYUaClwJvL9BHFRXmklqShgLqEgaA0cBdxhsYIlAEpG6BBB7U+7ZOvtkbfz9DNg72ZF40qWkUFnATY2MGHwK8CMDijZrgEP1EEaVKgipFG3ATz8yh38ocDNFR45x22ZeaM+WHQwaOrbvLuCCCHAoEVwviRFADXgbfUQmHjPvCOBW4LkZHf5jQKAu2bc/cADiR4BrKMqaqjZMAxzq8++nRPOUsFvaZ+O/ynD+oebZcjv8rFLCxAFLbwZ2UxQ3zgKHUuJqqWH7zw2eSgCxfPgnAt8GDghV566bBNBIcPg8IzpfOgMc6gy9rsTF7WPvRwNmolYQ8CZwBnAthZ9/mvHhPyoBcov1W3B4EPBD4BQPOJRIsZ3K7eKRjOqx8c8HPu8UZg4qGjXR1ZQwWmxyMDVcdHkJHA4TgjcxJmVdZ5Oa/bP3dRlwruPgEU+XrqxUAJnnK1pweC3wBMNpowiOjhXvUrP6yGKWJwLfAd5lfh9WXNOW1/8CuK8F3CWpKiDXhE+70ScaVP30GeBQZmCCEIfrHA4ka+MfYu7p+IDVYoHgVcCru1gb2NaaBMDhkcBtwCtK4DAEAjXCL6AVnC8VZt7hFHH8IyNM1iFFEOxk9iSC5FAvIKkZQbrgmxp6ONP1HN4InOaAw4EHD8SKeKnAFbPMvGPZE8eosvGnzjVPBz7ghIOnXesPoAu8KfvaP4CvOvcxDXgOLzVcNXZ0r69DdpX4j0nsdOP4b6HI3dvfY+Nbff8Q8CbgEmAvc/1prmbgsnMDN4zJ924HLU8C4PAcA8AOqACHvpBwLMG7cfyzgG8EbHxLjPcaVXUDsM283vnKoEWHKHcAX6YInPzVAYA+cHgChefwmRFhZfVk+s7CBq6N/wmKRBafjT922rEfC/zMHP5WF0rD2hjWoBGdyIbAj4EXALc7ANAHDg83f/uaQFhZPPq9LCEGTqHGpcCHA6lsVgLtpkj0vMtIivGSnGzSVUfQxOjLe4wI3eUAQB843AF8zwCuzYrnq0rpKksGK122A980gNMXxx+bw77GEOGD5vdJ7hXFuTqCxo6t/U7DfUOnfKoKHCrwRQp3LB5w6JNC9nt3GLD3Ro/zSR0r4GLgJIrs3lHm/RR1mV3CSBhuIIaTPmnQ9D89uGDgpJ2fAXzfAw59+GATeIYx817ocHeVT38IfNAAxJGTAb1STaKW+RATA6SuN7r1Dx5cIM57x1FEFJ8TmXNo92Kn0ePP9jh43K6pp1Akem4wf41gtlaAZqAStgG/A15EEWsP4YKxOcTbKFy1mx4/vfUX7G3Ux8GOKK8y8+4zxHKlubcJ3etoIl2aGGJF8f0UGcWfcg506gGH+wHfBd5n1IFWgEOM4+Y4ChfvXjOkjJUId1Eksu7O2cZv0hGUSwm5BVwj4EMUiaSPeJxGQ8f7drGxKIYV4NBigD87nD1ywKU9/F8aG//OmoefA9aSVAmwjNRxHzhUs/lXAK80h+ZzGllweCpFksmBHs+hVR+nUAxcGDivX0+RpXSvY+N3ufGVDjra9k0dXHC7Qeu3OIenHnD4MopahCMrwKFrfZwPvN3ggS8ZS+SRDph50X0XcusPoDVxwV+M2L6kNA21Chw+1VgIJ1WAQ2t9bABXA0cD73Eqm6Yr0j5OV6Fd/MTR1acDZwaGW9i/3Q58nSLbqAocWiK4MwA4V6JZtGZwUzIHLsCohC8YXPD3gNPIcvkFhssfV2H3T5zJKrqKbeJWpS2riwtuMf6CnwecRpZA3mo+c5gHF6zsvIA2zUBp0Wl0t0HsV0c6jY424PDYhELVrquA7JNC5w0mbRoUf24gmGQJ5MkUhaqneSKKKysBpKPNn6Ui4ueacx+nyCr+twcXDJ0sn0sNltAaEcWVBoGamQqwHL1VcUhuMOk6wsEkN93svcAPgCclRBTpcrPorkkAe78XGV3vOySLC35jwOGNHlzggsOdBhccFRlRlI6125W2k0KlYeKdAMdQpJCFGky4waTXAp+NCCaNKQpRdgNvC0QU2xy8tbS5gTkCxX+Zh90FfM7J4xsGgklnA+/AH0yyTqN9gK9RxAa2MqzxWzgGaCsaqDWridVw55kUadj7elSCG0y6nCLv8E+RTqPzDKHtVaPjh3a5PFwz9gSqo7e3KLpvuplAg4DT6A6DC24KBJOGTkTRdv7YzFgSSI4JIYuWIBtOmvhthhgmnkOyuOBvBhfEBpOOMUS2s1QC1umEkFVxBI2c1mxnRDSUdGv7bDBpGsAFtvvXhR11EyfHAiRDM1ADjafUOH5ICCZtGAfQToqkj2HFAduQ8H8yTghZiazgeSqWpUZNgHUa3UyRZHKrJ/4/yHz/sjQD2x5CrXMkn94DvJyivi8mD0A6OHep9ergruCMiWPq3RvZEFq7jgHWamJmQmXStlWehtp2MKhrG9nlLCDNsU+g0A+Wzs4RJP0waNZ6drD24+D74dFNzNTpxWyfELKSKkBXWaUNVnRodK+qVqw/QK7EJV0nrkFDs/l6Pd9hR1BXwV8PSHsV0EuUtjuFyhpybdNWgPYTQ/q1tgSgvcjuth9AM9xMyYQ4ZB1AoGSYE9h7AtccA2gmKkC7mkK9jC4ebmmVOm3ctGb61rhU6DlxkjxpID0s5vqScP9j53nFeY0G08y1SQJoCgNs83znjkSJZO9pf6fer/xc+zWwkft6rn9ATYmyw3MW29uUXKOWMICl9Lspiil0xkyfh80/SczZ+wpFfx9Xqtif70zkzFn3fBXwqxK32uvfk8gc9jnPo+hLPGuo5E8b6kamOakAe1h/pGitTs3R8LMO6LIInJOS0q2le76iIXe6vd+HgI81cM+dxABD9tTXzyrA3KpZDygVqsrV0xIYFFn1/kagH8CkYkqZr2BlI8As0xqTTOdWASkX1sQbkhKA8s3mDW1i+fVJgkQpj5HTCjWnpRY0sZusFQRV/r5xCxaPLiIcXIUHpMSFvn4CGlF1JBHULJ6/lcBA6Vnzg6uegTlG00uDAHphKkBrFodqBEhUzyFrwth3jbymzODAWfMCQwQqkc+ac7VQtAqQOcVJefKmeICVeD4rM64xS0f7RHrMZ5rYSPVIEx9BaU19Ps9nFuYJnHXwUlOsV4neKnFf5mL16H7ftbWhTl/iwRVSIX18fQukLYkyaCAA4qNuiRT5saogBo+ox4GlCYetka8JcVggpe9Sa1ladawADWy+BMRV1ec1YfJ3KmFIBGeGDkwj+hHEeE1D6ixW/Gub08NDKkAiNyok9mK7kUlJzGvg0HWG5AqBX/EccJUU9KkFTdzH1hpEaM2L6xyiMeY9iaRo8ZhtEnmode5bEvBC7L2lhJ5lmYUhKaKqirPFo7vncZBoosgmAqeoZ+5wU/kD6iHohSWfjBrs0yMB33rIPJIIkzEW4KkHVEqCStJARFQjTFsCOEMjo67akAVTyw9QtTkxNq5EijCdcW0iCCOGMDWhsVQTOlojcUZdM08bAIm1wsExJp1UeOJCphoeMzIUGwhxYyzXp+b8SeT3auR1NQEXSMQ5tN4fwGcChsy/EDpXz0NrQksXqdEeRiNNVR+jSMBVriwhH3GUABZtKLdfea9hoKV9LQzwX/a0Ye9X3svmVDzcpAQ4imKu3qhmpooGAjepCD0meic13chS817q3K8GME/s3pUlwBbwrBhfR+wIlMt7xuq0SqjED6O+Opi1rkQe9c2h6ItD+7W+azQjYrWKQ5L79dgzfgwGGNXosd+vbgLCUZkABHjQ/BvPaCApCe7GVFMvxlXbRHWyzpEBTaIpRoLbu43noDQe54EyCBTgDSVQqBGpXXgCNhoRXdOEBJNUUNokIdX1NcQSfcpBN5E48iiTuxjg/l5Crp86+D9qbdaBTsRvDgAAAABJRU5ErkJggg==\" alt=\"\" width=\"34\" height=\"34\"><b>Mandel Realty</b></div>\n      <button class=\"iconbtn\" data-cmdk aria-label=\"Jump to property, step or person\"><svg class=\"i\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"6.5\"/><path d=\"m20 20-4.2-4.2\"/></svg></button>\n    </div>\n\n    <header class=\"head\">\n      <div>\n        <div class=\"date\" id=\"today\"></div>\n        <h1 id=\"pageTitle\">Onboarding</h1>\n      </div>\n      <div class=\"headacts\">\n        <button class=\"btn\" id=\"rpOpen\" hidden aria-label=\"Show activity panel\" title=\"Show activity panel\"><svg class=\"i sm\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2.5\"/><path d=\"M15 4v16\"/></svg>Activity</button>\n        <button class=\"btn primary cta-add\" data-cta><svg class=\"i sm plus\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 5v14M5 12h14\"/></svg><span class=\"ctalbl\">Start onboarding</span></button>\n      </div>\n    </header>\n\n    <div id=\"onboarding\">\n      <div class=\"card stats\" id=\"stats\" aria-label=\"Onboarding summary\"></div>\n\n      <div class=\"secbar\">\n        <h2>Units <span class=\"count\" id=\"unitCount\"></span></h2>\n        <div class=\"seg\" role=\"tablist\" aria-label=\"View\">\n          <button class=\"on\" id=\"tPipe\" role=\"tab\" aria-selected=\"true\">Pipeline</button>\n          <button id=\"tSched\" role=\"tab\" aria-selected=\"false\">Schedule</button>\n        </div>\n      </div>\n\n      <section id=\"pipeView\">\n        <div class=\"filters\" id=\"filters\" role=\"search\" aria-label=\"Filter units\"></div>\n        <div class=\"card\" id=\"pipeCard\">\n          <div class=\"tablebox\">\n            <table>\n              <thead><tr>\n                <th>Property</th><th>Plan</th><th>Assigned to</th><th>Stage</th><th>Status</th><th>Due</th><th><span class=\"sr\">Actions</span></th>\n              </tr></thead>\n              <tbody id=\"tbody\"></tbody>\n            </table>\n          </div>\n          <div class=\"mcards\" id=\"mcards\"></div>\n        </div>\n      </section>\n\n      <section id=\"schedView\" hidden>\n        <div class=\"card\">\n          <div class=\"cardhead\">\n            <h3 id=\"wLabel\"></h3>\n            <div class=\"weeknav\">\n              <button class=\"btn sm\" id=\"wToday\">Today</button>\n              <button class=\"iconbtn\" id=\"wPrev\" aria-label=\"Previous week\"><svg class=\"i\" viewBox=\"0 0 24 24\"><path d=\"m15 6-6 6 6 6\"/></svg></button>\n              <button class=\"iconbtn\" id=\"wNext\" aria-label=\"Next week\"><svg class=\"i\" viewBox=\"0 0 24 24\"><path d=\"m9 6 6 6-6 6\"/></svg></button>\n            </div>\n          </div>\n          <div class=\"sched-desktop schedscroll\"><div class=\"sgrid\" id=\"sgrid\"></div></div>\n          <div class=\"agenda\"><div class=\"daystrip\" id=\"daystrip\"></div><ul class=\"alist\" id=\"alist\"></ul></div>\n        </div>\n      </section>\n    </div>\n\n    <div id=\"otherView\" hidden>\n      <div class=\"card placeholder\"><b id=\"phTitle\">Section</b><span id=\"phText\"></span></div>\n    </div>\n  </main>\n\n  <!-- Activity panel -->\n  <aside class=\"right\" aria-label=\"Activity\">\n    <div class=\"rtop\"><h2>Activity</h2><button class=\"iconbtn\" id=\"rpClose\" aria-label=\"Close activity panel\" title=\"Close panel\"><svg class=\"i sm\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M6 6l12 12M18 6 6 18\"/></svg></button></div>\n    <section class=\"card rcard\">\n      <div class=\"cardhead\"><h3>Up Next</h3><span class=\"count\" id=\"upCount\"></span></div>\n      <div class=\"rlist\" id=\"upnext\"></div>\n    </section>\n    <section class=\"card rcard\">\n      <div class=\"cardhead\"><h3>This Week</h3>\n        <div class=\"weeknav\">\n          <button class=\"iconbtn\" id=\"rPrev\" aria-label=\"Previous week\"><svg class=\"i sm\" viewBox=\"0 0 24 24\"><path d=\"m15 6-6 6 6 6\"/></svg></button>\n          <button class=\"iconbtn\" id=\"rNext\" aria-label=\"Next week\"><svg class=\"i sm\" viewBox=\"0 0 24 24\"><path d=\"m9 6 6 6-6 6\"/></svg></button>\n        </div>\n      </div>\n      <div class=\"mweek\" id=\"mweek\"></div>\n      <ul class=\"mlist\" id=\"mlist\"></ul>\n      <div class=\"mfootlink\"><button class=\"btn sm ghost\" id=\"rOpen\">Open full schedule</button></div>\n    </section>\n    <section class=\"card rcard\">\n      <div class=\"cardhead\"><h3>Team Today</h3>\n        <button class=\"btn sm cta-add\" id=\"qaBtn\" aria-expanded=\"false\"><svg class=\"i sm plus\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 5v14M5 12h14\"/></svg>Assign Task</button>\n      </div>\n      <form class=\"qa\" id=\"qaForm\" hidden>\n        <div class=\"field\"><label for=\"qaProp\">Property</label><select class=\"input\" id=\"qaProp\"></select></div>\n        <div class=\"field\"><label for=\"qaTask\">Task</label><input class=\"input\" id=\"qaTask\" placeholder=\"e.g. Measure living room\"></div>\n        <div class=\"two\">\n          <div class=\"field\"><label for=\"qaWho\">Assign to</label><select class=\"input\" id=\"qaWho\"></select><div data-teamnote></div></div>\n          <div class=\"field\"><label for=\"qaDue\">Due</label><div class=\"datefield\"><input class=\"input\" id=\"qaDue\" data-date placeholder=\"fri, nov 20, +3\" autocomplete=\"off\"><button type=\"button\" class=\"dfbtn\" data-dp tabindex=\"-1\" aria-label=\"Open calendar\"><svg class=\"i sm\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M3 10h18M8 3v4M16 3v4\"/></svg></button></div></div>\n        </div>\n        <div class=\"hint\" id=\"qaDueHint\"></div>\n        <div style=\"display:flex;gap:8px;justify-content:flex-end\">\n          <button type=\"button\" class=\"btn sm\" id=\"qaCancel\">Cancel</button>\n          <button type=\"submit\" class=\"btn sm primary\">Assign</button>\n        </div>\n      </form>\n      <div class=\"rlist\" id=\"teamToday\"></div>\n    </section>\n  </aside>\n</div>\n\n<!-- Mobile: thumb-reach primary action + bottom nav -->\n<button class=\"btn primary fab cta-add\" data-cta><svg class=\"i plus\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 5v14M5 12h14\"/></svg><span class=\"ctalbl\">Start onboarding</span></button>\n<nav class=\"bottomnav\" id=\"bottomnav\" aria-label=\"Sections\"></nav>\n\n<!-- Add Unit modal -->\n<div class=\"scrim center\" id=\"overlay\">\n  <form class=\"modal frost sheet\" id=\"unitForm\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"mTitle\" novalidate>\n    <h2 id=\"mTitle\">Start onboarding</h2>\n    <p class=\"lede\">Starts at Audit. Nothing moves to the next stage until Admin advances it.</p>\n    <div class=\"srcbanner\" id=\"fSrcBanner\"></div>\n    <div class=\"fgrid\">\n      <div class=\"field full\" id=\"fAddrWrap\"><label for=\"fAddr\">Property address <span class=\"gap\" data-gap=\"address\" hidden>Not in CRM</span></label><input class=\"input\" id=\"fAddr\" placeholder=\"Start typing an address…\" autocomplete=\"off\"><div class=\"hint\" id=\"fAddrHint\">Google Places autocomplete</div></div>\n      <div class=\"field\"><label for=\"fType\">Unit type</label>\n        <select class=\"input\" id=\"fType\"><option>Condo/Apartment</option><option>House</option><option>Townhouse</option><option>Cottage</option><option>Basement Suite</option><option>Loft</option></select></div>\n      <div class=\"field\"><label for=\"fBeds\">Bedrooms</label><select class=\"input\" id=\"fBeds\"><option>Studio</option><option>1BD</option><option selected>2BD</option><option>3BD</option><option>4BD+</option></select></div>\n      <div class=\"field\" id=\"fOwnerWrap\"><label for=\"fOwner\">Owner name</label><input class=\"input\" id=\"fOwner\" placeholder=\"e.g. Smith\" autocomplete=\"off\"><div class=\"hint\" id=\"fOwnerHint\"></div></div>\n      <div class=\"field\"><label for=\"fPhone\">Owner phone <em>(optional)</em></label><input class=\"input\" id=\"fPhone\" inputmode=\"tel\" placeholder=\"Any format\" autocomplete=\"off\"><div class=\"hint\" id=\"fPhoneHint\"></div></div>\n      <div class=\"field full\"><label for=\"fEmail\">Owner email <em>(optional)</em></label><input class=\"input\" id=\"fEmail\" type=\"email\" inputmode=\"email\" autocomplete=\"off\"></div>\n      <div class=\"field\" id=\"fPlanWrap\"><label for=\"fPlan\">Plan <span class=\"gap\" data-gap=\"plan\" hidden>Not in CRM</span></label>\n        <select class=\"input\" id=\"fPlan\"><option value=\"\">Choose a plan</option><option>Standard</option><option>Full Service</option><option>Growth</option><option>Essentials</option></select></div>\n      <div class=\"field\"><label for=\"fWho\">Primary assignee</label><select class=\"input\" id=\"fWho\"></select><div data-teamnote></div></div>\n      <fieldset class=\"furn\" id=\"furnWrap\">\n        <legend>Furniture program</legend>\n        <label class=\"furnopt\"><input type=\"radio\" name=\"fFurn\" value=\"none\" checked><span><b>None</b>No furniture program</span></label>\n        <label class=\"furnopt\"><input type=\"radio\" name=\"fFurn\" value=\"client\"><span><b>Client-funded</b>Client has a budget</span></label>\n        <div class=\"field\" data-fx=\"client\" hidden><label>Client budget — $<input class=\"input\" data-k=\"furnBudget\" inputmode=\"decimal\" placeholder=\"e.g. 4,500\" autocomplete=\"off\"></label></div>\n        <label class=\"furnopt\"><input type=\"radio\" name=\"fFurn\" value=\"fip\"><span><b>Furniture Investment Program</b>MRG funds the furniture. $0 upfront for the owner. Furniture transfers to owner free after 24 months. Requires a valid STR permit and team approval.</span></label>\n        <div class=\"hint bad\" data-fx=\"fipwarn\" hidden>FIP requires a valid STR permit — add licence below.</div>\n        <label class=\"furnopt\"><input type=\"radio\" name=\"fFurn\" value=\"contest\"><span><b>Contest unit</b>Capped package (cap to be set). No repayment. Client locked into contract. MRG selects winner.</span></label>\n        <div class=\"furnoff hint\" data-fx=\"off\" hidden>Furniture program is only available on Standard and Full Service plans</div>\n      </fieldset>\n      <fieldset class=\"furn tierset\" id=\"fGrowthTier\" hidden><legend>Growth tier <em class=\"req\">required</em></legend>\n        <label class=\"furnopt\"><input type=\"radio\" name=\"fGTier\" value=\"aligned\"><span><b>Aligned Growth</b>10% up to benchmark, 35% above</span></label>\n        <label class=\"furnopt\"><input type=\"radio\" name=\"fGTier\" value=\"confidence\"><span><b>Confidence Partner</b>5% up to benchmark, 45% above</span></label>\n        <div class=\"hint bad\" data-req hidden>Choose a tier to continue</div>\n      </fieldset>\n      <fieldset class=\"furn tierset\" id=\"fEssTier\" hidden><legend>Essentials tier <em class=\"req\">required</em></legend>\n        <label class=\"furnopt\"><input type=\"radio\" name=\"fETier\" value=\"book\"><span><b>Message &amp; Book</b>$199/mo</span></label>\n        <label class=\"furnopt\"><input type=\"radio\" name=\"fETier\" value=\"optimize\"><span><b>Message &amp; Optimize</b>$349/mo · includes pricing management</span></label>\n        <div class=\"hint bad\" data-req hidden>Choose a tier to continue</div>\n      </fieldset>\n      <div class=\"full hint\" id=\"flowHint\" style=\"margin-top:-6px\"></div>\n      <div class=\"field full\"><label for=\"fStart\">Start date</label><div class=\"datefield\"><input class=\"input\" id=\"fStart\" data-date placeholder=\"today, mon, nov 20, 11/20…\" autocomplete=\"off\"><button type=\"button\" class=\"dfbtn\" data-dp tabindex=\"-1\" aria-label=\"Open calendar\"><svg class=\"i sm\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M3 10h18M8 3v4M16 3v4\"/></svg></button></div><div class=\"hint\" id=\"fStartHint\"></div></div>\n      <h3 class=\"fsec full\">Lead and sale</h3>\n      <div class=\"field\"><label for=\"fSource\">Lead source</label><select class=\"input\" id=\"fSource\"></select></div>\n      <div class=\"field\" id=\"fRefWrap\" hidden><label for=\"fRef\">Referred by</label><input class=\"input\" id=\"fRef\" placeholder=\"Who referred them\" autocomplete=\"off\"></div>\n      <div class=\"field\"><label for=\"fBooked\">Call booked by</label><select class=\"input\" id=\"fBooked\"></select></div>\n      <div class=\"field\"><label for=\"fClosed\">Sale closed by</label><select class=\"input\" id=\"fClosed\"></select></div>\n      <fieldset class=\"furn full\" id=\"fCSet\"><legend>Contract status <span class=\"gap\" data-gap=\"contract\" hidden>Not in CRM</span></legend>\n        <label class=\"furnopt\"><input type=\"radio\" name=\"fCStat\" value=\"signed\"><span><b>Signed</b></span></label>\n        <label class=\"furnopt\"><input type=\"radio\" name=\"fCStat\" value=\"sent\"><span><b>Sent, awaiting signature</b></span></label>\n        <label class=\"furnopt\"><input type=\"radio\" name=\"fCStat\" value=\"not_sent\"><span><b>Not sent</b></span></label>\n        <div class=\"hint bad\" data-req hidden>Choose a contract status to continue</div>\n        <div class=\"cwarn\" id=\"fCWarn\" hidden>\n          <b>The contract is not signed yet.</b><span>Onboarding normally starts after the client signs.</span>\n          <label class=\"cconfirm\"><input type=\"checkbox\" id=\"fCConfirm\"><span>Start onboarding without a signed contract</span></label>\n        </div>\n      </fieldset>\n      <fieldset class=\"furn full feeset\" id=\"fFeeSet\"><legend>Onboarding fee</legend>\n        <label class=\"furnopt\"><input type=\"radio\" name=\"fFee\" value=\"Charged\"><span><b>Charged</b></span><span class=\"feein\">$<input class=\"input\" id=\"fFeeAmt\" inputmode=\"decimal\" placeholder=\"Amount\" aria-label=\"Fee amount\"></span></label>\n        <label class=\"furnopt\"><input type=\"radio\" name=\"fFee\" value=\"Waived\"><span><b>Waived</b></span><span class=\"feein\">Reason <input class=\"input\" id=\"fFeeWhy\" placeholder=\"Why it was waived\" aria-label=\"Waived reason\"></span></label>\n        <label class=\"furnopt\"><input type=\"radio\" name=\"fFee\" value=\"TBC\" checked><span><b>To be confirmed</b></span></label>\n      </fieldset>\n      <label class=\"crmopt full\" id=\"fMkLeadWrap\"><input type=\"checkbox\" id=\"fMkLead\" checked><span><b>Also create a CRM lead</b>Keeps every client in the CRM, including referrals.</span></label>\n      <h3 class=\"fsec full\">Handoff details <span class=\"gap\" data-gap=\"handoff\" hidden>Not in CRM. Fill in now or later in the Handoff tab</span></h3>\n      <div class=\"field\"><label for=\"hAccess\">Access method</label>\n        <select class=\"input\" id=\"hAccess\"><option value=\"\">Choose…</option><option>Lockbox</option><option>Smart lock</option><option>Keypad</option><option>Physical key</option><option>Key fob</option><option>Front desk</option></select></div>\n      <div class=\"field\"><label for=\"hAlarm\">Alarm</label><input class=\"input\" id=\"hAlarm\" placeholder=\"None, or panel location\" autocomplete=\"off\"></div>\n      <div class=\"field\"><label for=\"hWifi\">Wifi network</label><input class=\"input\" id=\"hWifi\" autocomplete=\"off\"></div>\n      <div class=\"field\"><label for=\"hWifiPw\">Wifi password</label><input class=\"input\" id=\"hWifiPw\" autocomplete=\"off\"></div>\n      <div class=\"field full\"><label for=\"hParking\">Parking</label><input class=\"input\" id=\"hParking\" placeholder=\"e.g. Underground P2, spot 114\" autocomplete=\"off\"></div>\n      <div class=\"field\"><label for=\"fStr\">STR licence number <em>(optional)</em></label><input class=\"input\" id=\"fStr\" autocomplete=\"off\" placeholder=\"e.g. STR-2401-ABCDE\"></div>\n      <div class=\"field\"><label for=\"fPermit\">Permit status</label><select class=\"input\" id=\"fPermit\"><option value=\"\">Choose…</option><option>Not required</option><option>Applied</option><option>Active</option><option>Expired</option></select></div>\n      <div class=\"field full\"><label for=\"hIssues\">Known issues</label><textarea class=\"input\" id=\"hIssues\" placeholder=\"Anything the team should know before the first guest\"></textarea></div>\n      <div class=\"field full\"><label for=\"fContract\">Management agreement (PDF) <em>(optional)</em></label>\n        <label class=\"drop\" id=\"fContractDrop\"><svg class=\"i sm\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 5v14M5 12h14\"/></svg><span id=\"fContractName\">Upload signed agreement</span><input type=\"file\" id=\"fContract\" accept=\".pdf,application/pdf\" class=\"sr\"></label>\n        <div class=\"hint\">Upload the signed contract before starting onboarding</div></div>\n      <div class=\"field full\"><label for=\"fNotes\">Notes <em>(optional)</em></label><textarea class=\"input\" id=\"fNotes\" placeholder=\"Access details, owner preferences…\"></textarea></div>\n    </div>\n    <div class=\"mfoot\">\n      <button type=\"button\" class=\"btn\" id=\"mCancel\">Cancel</button>\n      <button type=\"submit\" class=\"btn primary cta-go\" id=\"mCreate\">Create Unit<span class=\"swap\"><svg class=\"i sm a\" viewBox=\"0 0 24 24\"><path d=\"M5 12h14M13 6l6 6-6 6\"/></svg><svg class=\"i sm b\" viewBox=\"0 0 24 24\"><path d=\"m5 12 5 5 9-10\"/></svg></span></button>\n    </div>\n  </form>\n</div>\n\n<!-- 1. Entry choice -->\n<div class=\"scrim center\" id=\"startScrim\">\n  <div class=\"modal frost sheet startm\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"sTitle\">\n    <h2 id=\"sTitle\">Start onboarding</h2>\n    <p class=\"lede\">Where is this client coming from?</p>\n    <div class=\"pathgrid\">\n      <button type=\"button\" class=\"pathopt\" data-path=\"crm\">\n        <span class=\"pico\"><svg class=\"i\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"9\" cy=\"8\" r=\"3.5\"/><path d=\"M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6\"/><path d=\"M16 4.6a3.5 3.5 0 0 1 0 6.8\"/><path d=\"M18 14.3c2.1.7 3.5 2.6 3.5 5.7\"/></svg></span>\n        <b>From CRM</b><span>Pick a client who was booked and sold. Their details fill in for you.</span><em id=\"sCrmCount\"></em>\n      </button>\n      <button type=\"button\" class=\"pathopt\" data-path=\"manual\">\n        <span class=\"pico\"><svg class=\"i\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 5v14M5 12h14\"/></svg></span>\n        <b>Add manually</b><span>Referral or walk-in that is not in the CRM.</span><em>Creates a CRM lead too</em>\n      </button>\n    </div>\n    <div class=\"mfoot\"><button type=\"button\" class=\"btn ghost\" data-close=\"startScrim\">Cancel</button></div>\n  </div>\n</div>\n\n<!-- 2. From CRM picker -->\n<div class=\"scrim center\" id=\"pickScrim\">\n  <div class=\"modal frost sheet pickm\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"pTitle\">\n    <h2 id=\"pTitle\">Pick a client from the CRM</h2>\n    <p class=\"lede\">Only sold clients can start onboarding. A client already in onboarding links to their unit.</p>\n    <div class=\"pwfield pksearch\"><input class=\"input\" id=\"pickQ\" placeholder=\"Search name, address, phone or email\" autocomplete=\"off\" aria-label=\"Search leads\"></div>\n    <div id=\"pickList\" class=\"picklist\"></div>\n    <div class=\"mfoot spread\"><button type=\"button\" class=\"linkbtn\" data-path=\"manual\">Not in the CRM? Add manually</button><button type=\"button\" class=\"btn ghost\" data-close=\"pickScrim\">Cancel</button></div>\n  </div>\n</div>\n\n<!-- Command palette -->\n<div class=\"scrim top\" id=\"cmdkScrim\">\n  <div class=\"cmdk frost sheet\" role=\"dialog\" aria-modal=\"true\" aria-label=\"Jump to\">\n    <div class=\"q\"><svg class=\"i\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"6.5\"/><path d=\"m20 20-4.2-4.2\"/></svg>\n      <input id=\"cmdkQ\" placeholder=\"Jump to a property, step or person…\" autocomplete=\"off\" role=\"combobox\" aria-controls=\"cmdkRes\" aria-expanded=\"true\">\n      <kbd>esc</kbd></div>\n    <div class=\"res\" id=\"cmdkRes\" role=\"listbox\"></div>\n    <div class=\"foot\"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd class=\"kbdk\">⌘K</kbd> toggle</span></div>\n  </div>\n</div>\n\n<div class=\"pop frost\" id=\"pop\" hidden></div>\n\n<!-- Branded date picker -->\n<div class=\"dp frost\" id=\"dp\" hidden role=\"dialog\" aria-label=\"Choose a date\">\n  <div class=\"dphead\">\n    <button type=\"button\" class=\"iconbtn\" data-dpnav=\"-1\" aria-label=\"Previous month\"><svg class=\"i sm\" viewBox=\"0 0 24 24\"><path d=\"m15 6-6 6 6 6\"/></svg></button>\n    <b id=\"dpMonth\"></b>\n    <button type=\"button\" class=\"iconbtn\" data-dpnav=\"1\" aria-label=\"Next month\"><svg class=\"i sm\" viewBox=\"0 0 24 24\"><path d=\"m9 6 6 6-6 6\"/></svg></button>\n  </div>\n  <div class=\"dpgrid dpwd\" aria-hidden=\"true\"><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span></div>\n  <div class=\"dpgrid\" id=\"dpDays\" role=\"grid\"></div>\n  <div class=\"dpfoot\">\n    <button type=\"button\" class=\"btn sm\" data-dpquick=\"0\">Today</button>\n    <button type=\"button\" class=\"btn sm\" data-dpquick=\"1\">Tomorrow</button>\n    <button type=\"button\" class=\"btn sm\" data-dpquick=\"7\">In a week</button>\n  </div>\n</div>\n\n<!-- Follow-up draft (never auto-sends) -->\n<div class=\"scrim center\" id=\"draftScrim\">\n  <div class=\"modal frost sheet\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"dTitle\">\n    <h2 id=\"dTitle\">Follow-up draft</h2>\n    <p class=\"lede\" id=\"dLede\"></p>\n    <div class=\"field\"><label for=\"dText\">Message</label><textarea class=\"input\" id=\"dText\" rows=\"8\" style=\"min-height:190px\"></textarea></div>\n    <div class=\"mfoot\">\n      <button type=\"button\" class=\"btn ghost\" id=\"dCancel\">Cancel</button>\n      <button type=\"button\" class=\"btn\" id=\"dCopy\">Copy text</button>\n      <button type=\"button\" class=\"btn primary cta-go\" id=\"dWa\">Open in WhatsApp<span class=\"swap\"><svg class=\"i sm a\" viewBox=\"0 0 24 24\"><path d=\"M5 12h14M13 6l6 6-6 6\"/></svg><svg class=\"i sm b\" viewBox=\"0 0 24 24\"><path d=\"m5 12 5 5 9-10\"/></svg></span></button>\n    </div>\n  </div>\n</div>\n\n<!-- PDF viewer -->\n<div class=\"scrim center\" id=\"pdfScrim\">\n  <div class=\"viewer frost sheet\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"pdfName\">\n    <div class=\"vhead\">\n      <svg class=\"i\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" style=\"color:var(--redink)\"><path d=\"M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z\"/><path d=\"M14 3v5h5M9 13h6M9 17h4\"/></svg>\n      <div class=\"vt\"><b id=\"pdfName\"></b><span class=\"meta\" id=\"pdfMeta\"></span></div>\n      <button class=\"btn sm\" id=\"pdfDown\">Download</button>\n      <button class=\"iconbtn\" id=\"pdfClose\" aria-label=\"Close viewer\"><svg class=\"i\" viewBox=\"0 0 24 24\"><path d=\"M6 6l12 12M18 6 6 18\"/></svg></button>\n    </div>\n    <iframe id=\"pdfFrame\" title=\"PDF preview\"></iframe>\n  </div>\n</div>\n<div class=\"toast\" id=\"toast\" role=\"status\" aria-live=\"polite\"></div>";
  // Design script (adapted for host bridge)
/* =========================================================
   Data
   ========================================================= */
const TODAY = (function(){
  const t = (host.data && host.data.today) || new Date().toISOString().slice(0,10);
  const [y,m,d] = String(t).split('-').map(Number);
  return new Date(y, m-1, d);
})();
const DAY = 864e5;
const isMac = /Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent);

const ICON = {
  home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.3c2.1.7 3.5 2.6 3.5 5.7"/>',
  clip:'<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2.5" width="6" height="3" rx="1"/><path d="M9 11h6M9 15h4"/>',
  building:'<rect x="4" y="3" width="11" height="18" rx="1"/><path d="M15 9h5v12h-5"/><path d="M8 7h3M8 11h3M8 15h3"/>',
  team:'<circle cx="12" cy="7" r="3"/><circle cx="5" cy="10" r="2.2"/><circle cx="19" cy="10" r="2.2"/><path d="M6.5 20c0-3.3 2.4-5.5 5.5-5.5s5.5 2.2 5.5 5.5"/><path d="M1.5 19c0-2.3 1.4-3.9 3.5-4.2M22.5 19c0-2.3-1.4-3.9-3.5-4.2"/>',
  brief:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M3 12.5h18"/>',
  chart:'<path d="M4 4v16h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  spark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  flag:'<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  chev:'<path d="m6 9 6 6 6-6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check:'<path d="m5 12 5 5 9-10"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  alert:'<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16h0"/>',
  hourglass:'<path d="M6 3h12M6 21h12"/><path d="M8 3v3.5L12 12l4-5.5V3"/><path d="M8 21v-3.5L12 12l4 5.5V21"/>',
  trend:'<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  clipx:'<path d="m20.5 11.5-8.6 8.6a5 5 0 0 1-7-7l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l8-8"/>',
  step:'<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="12" r="2.5"/><path d="M8.5 12h7"/>',
  pulse:'<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'
};
const ic = (n, cls='') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;
const swapIcon = (a,b,cls='sm') => `<span class="swap"><svg class="i ${cls} a" viewBox="0 0 24 24">${ICON[a]}</svg><svg class="i ${cls} b" viewBox="0 0 24 24">${ICON[b]}</svg></span>`;

/* colour helper — everything in OKLCH */
const ok = (h,c,L=0.6,a) => `oklch(${L} ${c} ${h}${a!=null?` / ${a}`:''})`;
const tone = (h,c) => ({c:ok(h,c), t:ok(h,c*0.9,0.45), bg:ok(h,c,0.6,0.15), soft:`color-mix(in oklch, ${ok(h,c)} 13%, white)`});

const NAV_GROUPS = [
  {title:null,          items:[{id:'dashboard',label:'Dashboard',icon:'home'}]},
  {title:'Operations',  items:[{id:'onboarding',label:'Onboarding',icon:'clip'},{id:'properties',label:'Properties',icon:'building'},{id:'team',label:'Team',icon:'team'},{id:'sops',label:'SOPs',icon:'book'}]},
  {title:'Business',    items:[{id:'crm',label:'CRM',icon:'users'},{id:'clients',label:'Clients',icon:'brief'},{id:'revenue',label:'Revenue',icon:'chart'}]},
  {title:'Assistant',   items:[{id:'copilot',label:'Copilot',icon:'spark'}]}
];
const NAV_FOOT = [{id:'settings', label:'Settings', icon:'gear'}];
const ALL_NAV = [...NAV_GROUPS.flatMap(g=>g.items), ...NAV_FOOT];
const MOBILE_NAV = ['dashboard','crm','onboarding','team','settings'];

const TEAM = {
  fa1:   {name:'Field Assistant 1', ini:'F1', role:'Field assistant · to hire', color:ok(255,.13,.5)},
  fa2:   {name:'Field Assistant 2', ini:'F2', role:'Field assistant · to hire', color:ok(300,.13,.5)},
  rita:  {name:'Rita',   role:'VA',        color:ok(155,.12,.5)},
  ryan:  {name:'Ryan', role:'Sales, approvals, floor plans & final photos', color:ok(210,.1,.5)},
  shane: {name:'Shane',  role:'Software',  color:ok(355,.14,.5)},
  admin: {name:'Admin',  role:'Shared account', color:ok(270,.02,.38)}
};
const SOURCES = ['Referral','Meta ad','Furniture contest','Airbnb outreach','Other'];
const CONTRACT = {signed:'Signed', sent:'Sent, awaiting signature', not_sent:'Not sent'};
/* CRM leads, as the server sends them: id, name, addr, phone, email, source, stage, eligibility, unitId … */
let leads = [];
const leadById = id => leads.find(l=>String(l.id)===String(id));
/* Team comes from the Team tab (employees). Admin is the shared approvals account, not a person. */
const SIMULATE_EMPTY_TEAM = false;   // flip to true to preview the empty state
const assignable = () => Object.entries(TEAM).filter(([k])=>k==='admin' || !SIMULATE_EMPTY_TEAM);   // dropdowns list Team-tab employees only
const teamEmpty = () => assignable().filter(([k])=>k!=='admin').length===0;
const teamNoteHTML = () => teamEmpty()
  ? `<div class="teamwarn">${'<svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16h0"/></svg>'}No team members set up — go to <button type="button" class="linkbtn" data-nav="team">Team tab</button> to add employees</div>`
  : `<div class="teamnote">Only showing team members set up in the Team tab</div>`;
const SCHED_TEAM = ['fa1','fa2','rita','shane'];

const PLANS = {
  'Standard':     tone(255,.14),
  'Full Service': tone(300,.14),
  'Growth':       tone(155,.13),
  'Essentials':   tone(270,.02)
};

const STAGES = [
  {id:'audit',       name:'Audit',           ...tone(65,.14)},
  {id:'furniture',   name:'Furniture Plan',  ...tone(300,.14)},
  {id:'client',      name:'Client Approval', ...tone(88,.11)},
  {id:'procurement', name:'Procurement',     ...tone(255,.14)},
  {id:'photo',       name:'Photography',     ...tone(185,.11)},
  {id:'install',     name:'Install',         ...tone(42,.16)},
  {id:'app',         name:'App Setup',       ...tone(275,.16)},
  {id:'benchmark',   name:'Benchmark Setup', ...tone(185,.11)},   /* Growth only */
  {id:'software',    name:'Software Setup',  ...tone(355,.16)},
  {id:'live',        name:'Live',            ...tone(155,.13)}
];
const PHASES = [
  {name:'Prepare', ids:['audit','furniture','client']},
  {name:'Set up',  ids:['procurement','photo','install']},
  {name:'Launch',  ids:['app','benchmark','software','live']}
];
const SIDX = Object.fromEntries(STAGES.map((s,i)=>[s.id,i]));

/* =========================================================
   Host bridge — real data from OnboardingApp via host
   ========================================================= */
const NAME_TO_STAGE = {
  'Audit':'audit','Furniture':'furniture','Furniture Plan':'furniture','Client Approval':'client',
  'Procurement':'procurement','Photography':'photo','Install':'install','App Setup':'app',
  'Benchmark':'benchmark','Benchmark Setup':'benchmark','Software':'software','Software Setup':'software','Live':'live'
};
const STAGE_TO_NAME = {
  audit:'Audit', furniture:'Furniture', client:'Client Approval', procurement:'Procurement',
  photo:'Photography', install:'Install', app:'App Setup', benchmark:'Benchmark',
  software:'Software', live:'Live'
};

function teamKeyFromName(name){
  if(!name) return 'admin';
  if(String(name).toLowerCase()==='owner') return 'owner';
  const n=String(name).trim().toLowerCase();
  for(const [k,v] of Object.entries(TEAM)){ if(v.name.toLowerCase()===n) return k; }
  // One identity per person: "Rita" / "Rita O." and "Shane" / "Shane Mosoff" collapse to the roster entry
  const first = n.split(/\s+/)[0];
  if(first && first.length > 2){
    const hits = Object.entries(TEAM).filter(([,v]) => v.name.toLowerCase().split(/\s+/)[0] === first);
    if(hits.length === 1) return hits[0][0];
    if(hits.length > 1){
      const exact = hits.find(([,v]) => v.name.toLowerCase() === n);
      if(exact) return exact[0];
      // Prefer the longer roster name (canonical full name)
      hits.sort((a,b)=>b[1].name.length-a[1].name.length);
      return hits[0][0];
    }
  }
  // synthesize transient team member from people map
  const people = (host.data && host.data.people) || {};
  if(people[name]){
    const p=people[name];
    const key = 'p_'+name.replace(/\W+/g,'_').toLowerCase();
    if(!TEAM[key]) TEAM[key]={name, ini:p.i||name.slice(0,2), role:p.role||'Team', color:p.bg||ok(270,.02,.5)};
    return key;
  }
  const key = 'p_'+name.replace(/\W+/g,'_').toLowerCase();
  if(!TEAM[key]) TEAM[key]={name, ini:name.slice(0,2).toUpperCase(), role:'Team', color:ok(270,.02,.5)};
  return key;
}

function specialFromLabel(name){
  const n=String(name||'');
  if(/Ryan approves each line/i.test(n)) return 'ryanlines';
  if(/Client approves budget and every line/i.test(n)) return 'clientlines';
  if(/Mark as sent to client/i.test(n)) return 'sent';
  if(/Pick up items from delivery/i.test(n)) return 'pickup';
  if(/Cleaner confirmed for first turnover/i.test(n)) return 'cleaner';
  return null;
}
function mapTasksFromHost(unitId, stageName, tasksByUnit){
  const byStage = (tasksByUnit && tasksByUnit[unitId]) || {};
  const list = byStage[stageName] || byStage[STAGE_TO_NAME[NAME_TO_STAGE[stageName]] ] || [];
  // Prefer stage id keys if present
  const sid = NAME_TO_STAGE[stageName] || stageName;
  const alt = byStage[sid] || list;
  return (alt || []).map(t=>{
    const name = t.label || t.name;
    const who = teamKeyFromName(t.who);
    return {
      id: t.id,
      name,
      who,
      due: t.due || null,
      done: !!t.done,
      na: !!t.skipped,
      notes: t.notes || '',
      doneBy: t.doneBy || '',
      special: specialFromLabel(name),
      link: /Review audit in cleaner app/i.test(name) ? 'https://portal.stravo.ai' : null,
    };
  });
}

function statusFromStages(uView){
  const st = uView.stages || [];
  const i = st.findIndex(s=>s!=='done');
  const cur = i<0 ? 'done' : st[i];
  if(i<0 || (uView.activeStages||[]).slice(-1)[0]==='Live' && st.every(s=>s==='done')) return {k:'done'};
  if(cur==='blocked') return {k:'blocked', reason:uView.blockReason||'Flagged'};
  if(cur==='submitted') return {k:'waiting', on:'Admin'};
  if(cur==='todo') return {k:'assign'};
  return {k:'progress'};
}

function applyHostData(data){
  if(!data) return;
  host.data = data;
  leads = (data.leads||[]).map(l=>Object.assign({}, l));
  const people = data.people || {};
  const team = data.team || [];
  for(const name of team){
    const p = people[name] || {};
    const key = teamKeyFromName(name);
    TEAM[key] = {name, ini:p.i||name.slice(0,2).toUpperCase(), role:p.role||'Team', color:p.bg||TEAM[key]?.color||ok(270,.02,.5)};
  }
  const feeLabel = (s) => {
    const v = String(s||'').toLowerCase();
    if(v==='charged') return 'Charged';
    if(v==='waived') return 'Waived';
    if(v==='tbc' || v==='to be confirmed') return 'TBC';
    return s || '';
  };
  const alarmLabel = (t, info) => {
    const v = String(t||'').trim();
    if(!v || /^none$/i.test(v)) return {alarm:'None', alarmInfo:''};
    if(/^has alarm$/i.test(v)) return {alarm:'Has alarm', alarmInfo:info||''};
    return {alarm:'Has alarm', alarmInfo:info||v};
  };
  const mapped = (data.units||[]).map(u=>{
    const active = u.activeStages || [];
    const statuses = u.stages || [];
    const curIdxInActive = statuses.findIndex(s=>s!=='done');
    const curName = curIdxInActive<0 ? (active[active.length-1]||'Live') : active[curIdxInActive];
    const sid = NAME_TO_STAGE[curName] || 'audit';
    const stageIdx = SIDX[sid] ?? 0;
    const allTasks = {};
    for(const sn of active){
      allTasks[NAME_TO_STAGE[sn]||sn] = mapTasksFromHost(u.id, sn, data.tasks);
    }
    const curTasks = allTasks[sid] || mapTasksFromHost(u.id, curName, data.tasks);
    const past = {}, extra = {};
    for(const sn of active){
      const id = NAME_TO_STAGE[sn]||sn;
      if(id===sid) continue;
      const pos = active.indexOf(sn), curPos = active.indexOf(curName);
      if(pos < curPos) past[id] = allTasks[id] || [];
      if(pos > curPos) extra[id] = allTasks[id] || [];
    }
    const h = u.handoff || {};
    const al = alarmLabel(h.alarm_type, h.alarm_instructions);
    const docs = (u.docs||[]).map(d=>({
      name:d.name, date:(d.uploadedAt||'').slice(0,10), tag:d.docType||'', url:d.url, id:d.id
    }));
    const history = (u.history||[]).map(hh=>({ts:hh.ts, text:hh.action+(hh.detail?(' · '+hh.detail):''), type:'info', by:hh.actor||'admin'}));
    const notes = [];
    (u.history||[]).forEach(hh=>{
      if(/^Note$/i.test(hh.action)){
        let t=hh.detail||'', stage;
        const m=/^([^:]+):\s*([\s\S]+)$/.exec(t);
        if(m && NAME_TO_STAGE[m[1]]){ stage=NAME_TO_STAGE[m[1]]; t=m[2]; }
        notes.push({ts:hh.ts, t:t||hh.action, by:teamKeyFromName(hh.actor||'admin'), stage});
      }
    });
    (u.stageMeta||[]).forEach(mm=>{
      if(mm.notes) notes.push({ts:mm.approvedAt||'', t:mm.notes, by:'admin', stage:NAME_TO_STAGE[mm.stage]||mm.stage});
    });
    const skipped = {};
    (u.stageMeta||[]).forEach(mm=>{ if(mm.skipped) skipped[NAME_TO_STAGE[mm.stage]||mm.stage]=true; });
    const stageDue = u.stageDueOn || null;
    const lines = (u.lines||[]).map(l=>({
      id: l.id, item:l.item, room:l.room||'', qty:l.qty||1, price:l.price||0,
      ryan:!!l.ryan, client:l.client||'pending', deliver:l.deliver||'unit'
    }));
    return {
      id: u.id,
      addr: u.address,
      type: u.type,
      plan: u.plan || '',
      planTier: u.planTier || '',
      furniture: u.furniture || 'none',
      furnitureBudget: u.furnitureBudget || 0,
      owner: u.owner==='—'?'':u.owner,
      assignee: teamKeyFromName(u.assignee),
      stage: stageIdx,
      status: statusFromStages(u),
      due: stageDue,
      day: u.days||0,
      isNew: !!u.isNew,
      contractStatus: u.contractStatus || 'signed',
      leadId: u.leadId || null,
      leadName: u.leadName || '',
      leadSource: u.leadSource || '',
      email: u.ownerEmail || '',
      referredBy: u.referredBy || '',
      bookedBy: u.bookedBy || '',
      closedBy: u.closedBy || '',
      flags: u.flagCount||0,
      notes,
      cleaner: '',
      tasks: curTasks,
      past,
      extra,
      activeStageIds: active.map(sn=>NAME_TO_STAGE[sn]||sn).filter(Boolean),
      lines,
      budgetOk: lines.length>0 && lines.every(l=>l.client!=='declined') && lines.some(l=>l.client==='approved'),
      handoff: {
        strLicence: u.strLicence||'',
        permit: u.strPermitStatus||'',
        fee: feeLabel(u.feeStatus),
        feeAmount: u.feeAmount!=null?String(u.feeAmount):'',
        feeReason: u.feeReason||'',
        access: h.access_method||'',
        accessLoc: h.access_location||'',
        entry: h.access_code||'',
        bldMethod: h.building_entry_method||'',
        bldCode: h.building_code||'',
        fobCount: h.fob_count!=null?String(h.fob_count):'',
        parking: h.parking_spot||'',
        parkMethod: h.parking_method||'',
        parkCode: h.parking_code||'',
        wifi: h.wifi_name||'',
        wifiPw: h.wifi_password||'',
        alarm: al.alarm,
        alarmInfo: al.alarmInfo,
        cName: h.concierge_name||'',
        cPhone: h.concierge_phone||'',
        cHours: h.concierge_hours||'',
        issues: h.known_issues||'',
        whatsapp: u.ownerWhatsapp||'',
        phone: u.ownerPhone||'',
        contactPref: '',
        airbnbUrl: u.airbnbUrl||'',
        hospId: u.hospitablePropertyId||'',
        existingUrl: u.existingAirbnbUrl||'',
        deliverTo: u.deliverTo||'unit',
        buildingName: u.buildingName||'',
        unitFloor: u.unitFloor||'',
        elevator: u.elevatorBookingRequired===true ? 'Yes' : (u.elevatorBookingRequired===false ? 'No' : ''),
        movingHours: u.movingHours||'',
        coi: u.coiRequired===true ? 'Yes' : (u.coiRequired===false ? 'No' : ''),
        bmContact: u.buildingManager||'',
        buildingNotes: u.buildingNotes||''
      },
      cleanerPropertyId: u.cleanerPropertyId||'',
      portalLinkSentAt: u.portalLinkSentAt || null,
      docs,
      history,
      skipped,
      deliverTo: u.deliverTo||'unit',
      growthTier: u.planTier && u.plan==='Growth' ? u.planTier : undefined,
      essentialsTier: u.planTier && u.plan==='Essentials' ? u.planTier : undefined,
      _activeStages: active,
      blockReason: u.blockReason||''
    };
  });
  units.length = 0;
  mapped.forEach(u=>units.push(u));
  const liveKeys = (data.team||[]).map(n=>teamKeyFromName(n)).filter(k=>k && k!=='admin');
  if(liveKeys.length){
    SCHED_TEAM.length = 0;
    liveKeys.forEach(k=>{ if(!SCHED_TEAM.includes(k)) SCHED_TEAM.push(k); });
  }
  const sched = data.sched || [];
  const skippedByUnit = {};
  mapped.forEach(u=>{ skippedByUnit[u.id] = u.skipped || {}; });
  events = sched.map((e,i)=>({
    id: e.id || ('e'+i),
    who: teamKeyFromName(e.who),
    unit: e.unit,
    task: e.task,
    stage: NAME_TO_STAGE[e.stage] || e.stage,
    start: e.start,
    span: e.span||1,
    st: e.status==='In progress'?'In Progress':(e.status||'Scheduled')
  })).filter(e=>{
    const sk = skippedByUnit[e.unit];
    return !(sk && sk[e.stage]);
  });

  // Reconcile auto line-item tasks and ready status from persisted lines (never auto-advances)
  mapped.forEach(u=>{ try{ refreshStatus(u); }catch(_){ } });
}

function reload(data){
  applyHostData(data || host.data);
  try { renderNav(); fillSelects(); renderAll(); } catch(err){ if(host.onError) host.onError(err); }
}

function act(op, payload){
  return host.act(op, payload || {}).then(function(res){
    return host.load().then(function(d){ reload(d); return res; });
  }).catch(function(e){ if(host.onError) host.onError(e); return host.load().then(reload); });
}



const readFileDataUrl = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result || ''));
  r.onerror = () => reject(r.error || new Error('read failed'));
  r.readAsDataURL(file);
});

/* Plan-based flow: which stages apply to a unit */
const FULL_FLOW = ['audit','furniture','client','procurement','photo','install','app','software','live'];
function flowFor(plan, furniture){
  if(plan==='Standard' || plan==='Full Service') return (furniture && furniture!=='none') ? FULL_FLOW : ['audit','photo','app','software','live'];
  if(plan==='Growth')     return ['audit','app','benchmark','software','live'];
  if(plan==='Essentials') return ['audit','app','software','live'];
  // No plan: same furniture gating as Standard — no furniture stages without a furniture program
  return (furniture && furniture!=='none') ? FULL_FLOW : ['audit','photo','app','software','live'];
}
function getActiveStages(unit){
  if(unit && Array.isArray(unit.activeStageIds) && unit.activeStageIds.length) return unit.activeStageIds;
  return flowFor(unit.plan, unit.furniture);
}
/* stages drawn in the flow: every regular stage, plus Benchmark only for Growth */
const shownStages = u => STAGES.filter(s=>s.id!=='benchmark' || u.plan==='Growth').map(s=>s.id);
function nextActiveIdx(u){
  const act=getActiveStages(u), pos=act.indexOf(STAGES[u.stage].id);
  return SIDX[act[Math.min(pos+1, act.length-1)]];
}

const TEMPLATES = {
  audit:[['Schedule onboarder visit 1','admin'],['Onboarder completes audit in cleaner app','onb'],['Upload audit report PDF','admin'],['Review audit in cleaner app — approve or request changes','admin',null,'link']],
  furniture:[['Upload AI-generated room illustrations (from GPT skill)','rita'],['Build room-by-room furniture sourcing list','rita'],['Confirm all items within budget','rita'],['Upload full furniture report PDF to docs','rita'],['Internal review and admin approval','admin']],
  client:[['Upload furniture plan PDF','rita'],['Ryan approves each line item','ryan','ryanlines'],['Mark as sent to client via WhatsApp','admin','sent'],['Client approves budget and every line','admin','clientlines']],
  procurement:[['Confirm delivery address (unit or home address)','admin'],['Place orders — Amazon, HomeSense, Dollarama and other stores','rita'],['Confirm delivery dates for all orders','rita'],['Receive and photograph all delivered items','onb'],['Confirm all items received and accounted for','admin']],
  photo:[['Schedule shoot','ryan'],['Shoot on site','ryan'],['Edit & upload photos','ryan']],
  install:[['Pick up items from delivery address (if not unit)','onb','pickup'],['Furniture install and staging per plan','onb'],['Photograph all installed furniture and rooms (reference photos)','onb'],['Cleaner confirmed for first turnover (manual)','admin','cleaner'],['Final walkthrough and sign-off','ryan']],
  app:[['Schedule onboarder visit 2','admin'],['Set up unit items and spots with reference photos','onb'],['Enter all inventory items with counts and thresholds','onb'],['Schedule recurring maintenance checks','onb'],['Film how-to videos for each system and room','onb'],['Review and publish guide clips to guidebook','admin'],['Cleaner confirmed for first turnover (manual — name and contact)','admin','cleaner']],
  benchmark:[['Collect 12 months of revenue history from owner','rita'],['Enter monthly benchmarks for all 12 calendar months','rita'],['Admin reviews and confirms benchmarks','admin']],
  software:[
    ['Airbnb: photos, title, description, amenities','admin'],
    ['Airbnb: house rules, check-in/out instructions','admin'],
    ['Airbnb: pricing — nightly, cleaning fee, extra guest fee','admin'],
    ['Airbnb: min/max stay, advance notice settings','admin'],
    ['Connect to Hospitable — owner accepts connection','owner'],
    ['Hospitable: messaging templates set up','admin'],
    ['Hospitable: automated review templates','admin'],
    ['Booking.com: listing live (set up in Hospitable)','owner'],
    ['VRBO: owner creates account and authorizes','owner'],
    ['PriceLabs: connected, base price, min price, orphan days set','admin'],
    ['Cleaner confirmed for first turnover (manual)','admin'],
    ['Cleaning fees set on all channels','admin'],
    ['Guidebook: how-to videos published, URL set','admin'],
    ['Test booking: reservation fires, messaging works, cleaning task created','admin'],
    ['Save Hospitable property ID and Airbnb URL to property record','admin']],
  live:[['Confirm all channels live — Airbnb, Hospitable, Booking, VRBO','admin'],['Confirm iCal sync active — cleaning tasks generating','admin'],['Confirm first cleaning task created in cleaner app','admin'],['Notify client — property is live','admin'],['Record live date','admin']]
};

const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parse = s => { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); };
const addDays = (d,n) => new Date(d.getFullYear(), d.getMonth(), d.getDate()+n);
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const fmt = s => { const d=parse(s); return `${MON[d.getMonth()]} ${d.getDate()}`; };
const fmtLong = d => `${WD[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
const diff = s => Math.round((parse(s)-TODAY)/DAY);
const esc = s => String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short = a => String(a||'').replace(/^\d+\s+/,'').replace(/\s+[NSEW]$/,'');
/** Display-only: "1,100SqFt." → "1,100 SqFt." */
const formatType = t => String(t||'').replace(/(\d)\s*[Ss]q\.?\s*[Ff]t\.?/g, '$1 SqFt.');
/** Address label for activity/schedule rows — never "Unknown ·" */
const addrLabel = u => {
  const a = u && u.addr != null ? String(u.addr).trim() : '';
  if (!a || /^unknown$/i.test(a)) return '';
  return short(a);
};
const taskLine = (u, task) => {
  const a = addrLabel(u), t = String(task||'').trim();
  if (a && t) return a + ' · ' + t;
  return t || a || '';
};
/** Dedupe schedule chips / activity rows by who|unit|task|start */
const dedupeEv = list => {
  const seen = new Set();
  return list.filter(x => {
    const ev = x.ev || x;
    const key = [ev.who, ev.unit, String(ev.task||'').toLowerCase(), ev.start].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/* =========================================================
   Forgiving input → clean output
   ========================================================= */
function parseDate(raw){
  let s = String(raw||'').trim().toLowerCase().replace(/\s+/g,' ');
  if(!s) return null;
  if(/^(today|tod|now)$/.test(s)) return TODAY;
  if(/^(tomorrow|tmr|tmrw|tom)$/.test(s)) return addDays(TODAY,1);
  if(/^yesterday$/.test(s)) return addDays(TODAY,-1);
  let m;
  if((m=s.match(/^(?:in\s+)?\+?(\d{1,3})\s*(d|day|days)$/)) || (m=s.match(/^\+(\d{1,3})$/))) return addDays(TODAY,+m[1]);
  if((m=s.match(/^(?:in\s+)?(\d{1,2})\s*(w|wk|wks|week|weeks)$/))) return addDays(TODAY,7*m[1]);
  const wd = s.replace(/^next\s+/,'').slice(0,3), wi=['sun','mon','tue','wed','thu','fri','sat'].indexOf(wd);
  if(wi>=0 && /^(next\s+)?[a-z]+$/.test(s)){ let n=(wi-TODAY.getDay()+7)%7; if(n===0||s.startsWith('next')) n+= n===0?7:0; return addDays(TODAY,n||7); }
  const mon = t => ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(t.slice(0,3));
  const build = (y,mo,d,explicitYear) => {
    if(mo<0||mo>11||d<1||d>31) return null;
    let dt=new Date(y,mo,d); if(dt.getMonth()!==mo) return null;
    if(!explicitYear && (dt-TODAY)/DAY < -60) dt=new Date(y+1,mo,d);
    return dt;
  };
  const yr = y => y ? (y.length===2?2000+(+y):+y) : TODAY.getFullYear();
  s = s.replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+/,'');
  if((m=s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/))) return build(+m[1],m[2]-1,+m[3],true);
  if((m=s.match(/^([a-z]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{2,4})?$/)) && mon(m[1])>=0) return build(yr(m[3]),mon(m[1]),+m[2],!!m[3]);
  if((m=s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,})\.?,?\s*(\d{2,4})?$/)) && mon(m[2])>=0) return build(yr(m[3]),mon(m[2]),+m[1],!!m[3]);
  if((m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/))) return build(yr(m[3]),m[1]-1,+m[2],!!m[3]);
  if((m=s.match(/^(\d{1,2})(?:st|nd|rd|th)?$/))){ let dt=build(TODAY.getFullYear(),TODAY.getMonth(),+m[1],true); if(dt && dt<TODAY) dt=new Date(dt.getFullYear(),dt.getMonth()+1,+m[1]); return dt; }
  return null;
}
const ABBR = {street:'St',st:'St',avenue:'Ave',ave:'Ave',av:'Ave',road:'Rd',rd:'Rd',drive:'Dr',dr:'Dr',boulevard:'Blvd',blvd:'Blvd',crescent:'Cres',cres:'Cres',court:'Ct',ct:'Ct',lane:'Ln',ln:'Ln',place:'Pl',pl:'Pl',parkway:'Pkwy',terrace:'Terr',circle:'Cir',way:'Way',west:'W',east:'E',north:'N',south:'S',apt:'Apt',unit:'Unit',suite:'Suite'};
const DIRS = {w:'W',e:'E',n:'N',s:'S'};
function cleanAddress(raw){
  const words = String(raw||'').replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
  return words.map((w,i)=>{
    const bare = w.toLowerCase().replace(/[.,]+$/,''), tail = /,$/.test(w)?',':'';
    if(/\d/.test(bare)) return bare.toUpperCase()+tail;
    if(i>0 && ABBR[bare]) return ABBR[bare]+tail;
    if(i===words.length-1 && DIRS[bare]) return DIRS[bare]+tail;
    return bare.charAt(0).toUpperCase()+bare.slice(1)+tail;
  }).join(' ');
}
const cleanName = raw => String(raw||'').replace(/\s+/g,' ').trim().toLowerCase().replace(/(^|[\s\-'])([a-z])/g,(m,a,b)=>a+b.toUpperCase()).replace(/\bMc([a-z])/g,(m,a)=>'Mc'+a.toUpperCase());
function cleanPhone(raw){
  const s=String(raw||'').trim(); if(!s) return {v:'',ok:true};
  let d=s.replace(/\D/g,''); if(d.length===11 && d[0]==='1') d=d.slice(1);
  if(d.length===10) return {v:`(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`, ok:true};
  return {v:s, ok:false};
}
/* live "saves as" hint for a forgiving field */
function bindClean(input, hint, fn, opts={}){
  const run = () => {
    const v=input.value.trim();
    if(!v){ hint.className='hint'; hint.innerHTML=opts.empty||''; return; }
    const r=fn(v);
    if(r.ok){ hint.className='hint good'; hint.innerHTML=`${ic('check','sm')}${esc(r.label)}`; }
    else { hint.className='hint bad'; hint.textContent=r.label; }
  };
  input.addEventListener('input', run);
  input.addEventListener('blur', ()=>{ const v=input.value.trim(); if(!v) return; const r=fn(v); if(r.ok && r.clean!=null) input.value=r.clean; run(); });
  run();
}
const dateRule = v => { const d=parseDate(v); return d ? {ok:true,label:fmtLong(d)+(d.getFullYear()!==TODAY.getFullYear()?`, ${d.getFullYear()}`:''),clean:fmtLong(d)} : {ok:false,label:'Try “fri”, “nov 20”, “11/20” or “+3”'}; };

/* =========================================================
   State
   ========================================================= */
function makeTasks(stageId, unit, doneCount=0){
  // Essentials · Message & Book has no pricing management → no PriceLabs task
  const tpl = TEMPLATES[stageId].slice()
    .filter(t=> !(stageId==='install' && t[2]==='pickup' && (unit.deliverTo||'unit')==='unit'));   // pickup only when delivered off-site
  const furnTask = {client:'Client approves furniture plan and total cost', fip:'FIP contract signed by owner (24-month term)', contest:'Contest agreement signed by owner'}[unit.furniture];
  if(stageId==='client' && furnTask) tpl.push([furnTask,'admin']);
  // Essentials: tier decides which software tasks apply; the rest are marked N/A automatically
  const essKeep = stageId==='software' && unit.plan==='Essentials'
    ? (unit.essentialsTier==='optimize'
        ? (n => !/^(VRBO|Booking\.com|Guidebook)/.test(n))
        : (n => /^Hospitable: messaging|^Hospitable: automated review|^Test booking|^Save Hospitable property ID/.test(n)))
    : null;
  return tpl.map((t,i)=>({
    na: essKeep ? !essKeep(t[0]) : undefined, auto_na: essKeep ? !essKeep(t[0]) : undefined,
    name:t[0], who: t[1]==='onb' ? unit.assignee : t[1],
    due: (t[2]==='nodue'||t[2]==='clientlines') ? null : iso(addDays(TODAY, Math.min(i+1, 4))), done: i < doneCount && !(essKeep && !essKeep(t[0])), special: t[2]||null, link: t[3]==='link' ? CLEANER_APP : null
  }));
}
const AUTO = ['ryanlines','clientlines'];
const CLEANER_APP = 'https://portal.stravo.ai';
const appLink = () => `<a class="applink" href="${CLEANER_APP}" target="_blank" rel="noopener">Open cleaner app →</a>`;
const ESS_TIERS = {book:{name:'Message & Book', short:'Book', price:199}, optimize:{name:'Message & Optimize', short:'Optimize', price:349}};
const GROWTH_TIERS = {aligned:{name:'Aligned Growth', short:'Aligned', desc:'10% up to benchmark, 35% above'}, confidence:{name:'Confidence Partner', short:'Confidence', desc:'5% up to benchmark, 45% above'}};
const tierOf = u => u.plan==='Essentials' && ESS_TIERS[u.essentialsTier] ? ESS_TIERS[u.essentialsTier] : u.plan==='Growth' && GROWTH_TIERS[u.growthTier] ? GROWTH_TIERS[u.growthTier] : null;
const tierLine = u => { const t=tierOf(u); if(!t) return ''; return u.plan==='Essentials' ? `${t.name} · ${money(t.price)}/mo` : `${t.name} · ${t.desc}`; };
const nowISO = () => new Date().toISOString();
function relTime(ts){
  if(!ts) return '';
  const d=new Date(ts), now=new Date(), s=(now-d)/1000;
  if(s < 60) return 'just now';
  if(s < 3600) return `${Math.floor(s/60)} min ago`;
  const sameDay = d.toDateString()===now.toDateString();
  if(sameDay) { const h=Math.floor(s/3600); return `${h} hour${h===1?'':'s'} ago`; }
  const y=new Date(now); y.setDate(now.getDate()-1);
  if(d.toDateString()===y.toDateString()) return 'yesterday';
  return `${MON[d.getMonth()]} ${d.getDate()}`;
}
const whoName = k => k==='owner' ? 'Owner' : (TEAM[k] ? TEAM[k].name : k);
function logH(u, text, type='info'){ (u.history=u.history||[]).push({ts:nowISO(), text, type}); }
const money = n => '$'+Math.round(n).toLocaleString('en-CA');
let lineId = 100;
let uid = 10;
/* Units and schedule events come only from the server (applyHostData). No sample data ships. */
let units = [];

let events = [];
let evId = 20;
const ui = { histAll:new Set(), f:{stage:'',who:'',plan:'',attn:false,q:''}, addTask:{}, tab:{}, skipAsk:{}, archiveAsk:null, hoEdit:new Set(), rweek:0, rday:(TODAY.getDay()+6)%7, changes:new Set(), nav:'onboarding', view:'pipe', open:new Set(), week:0, mday:(TODAY.getDay()+6)%7, upDone:{}, busy:new Set(), auditExp:{}, intakeLive:{}, stravoModal:null };
let auditPollTimer = null;

/* =========================================================
   Helpers
   ========================================================= */
const $ = s => root.querySelector(s) || document.querySelector(s);
/** Desktop: scroll the main pane only — sidebar stays fixed. Phone: fall back to window. */
const scrollMain = (opts = {}) => {
  const main = root.querySelector('main');
  if (main && getComputedStyle(main).overflowY !== 'visible') main.scrollTo({ top: 0, ...opts });
  else window.scrollTo({ top: 0, ...opts });
};
const unitById = id => units.find(u=>String(u.id)===String(id));
const mobile = () => matchMedia('(max-width:767px)').matches;

function avatar(who, unit, cls=''){
  if (who==='owner' || who==='client'){
    const o = unit ? unit.owner : '?';
    return `<span class="av ${cls}" style="background:${ok(270,.02,.5)}" title="${who==='owner'?'Owner':'Client'} · ${esc(o)}">${esc(o[0]||'?')}</span>`;
  }
  const m = TEAM[who]; if(!m) return '';
  return `<span class="av ${cls}" style="background:${m.color}" title="${m.name}">${(m.ini||m.name.slice(0,2)).toUpperCase()}</span>`;
}
const furnText = u => u.furniture==='client' ? `Furnished · ${money(u.furnitureBudget||0)}` : u.furniture==='fip' ? 'FIP · 24 mo' : u.furniture==='contest' ? 'Contest unit' : '';
const furnBadge = u => (u.furniture && u.furniture!=='none') ? ` <span class="furnb ${u.furniture}">${furnText(u)}</span>` : '';
const planChip = u => {
  const p=PLANS[u.plan] || tone(270,.02);
  const label=u.plan || 'No plan';
  const t=u.plan?tierOf(u):null;
  return `<span class="chip" style="background:${p.bg};color:${p.t}" ${t?`title="${esc(tierLine(u))}"`:''}>${esc(label)}${t?`<span class="chipsub"> · ${t.short}</span>`:''}</span>${furnBadge(u)}`;
};
const stageChip = i => { const s=STAGES[i]||STAGES[0]; return `<span class="chip" style="background:${s.bg};color:${s.t}">${s.name}</span>`; };

/* ---------- WhatsApp welcome (copy into group chat after the first call) ---------- */
const WA_TEMPLATES = {
  standard: (first) =>
`Hey ${first}! 👋 Welcome to the MRG family, so excited to have you on board. Here's what happens next:

1️⃣ We'll reach out shortly to book your onboarding visit
2️⃣ Our team will walk through the property, take care of photos, and get your listing set up
3️⃣ We handle pricing, guest messaging, and everything else from there

Any questions, just message here, this is your direct line to us 📲
Shane & Ryan, Mandel Realty Group`,
  growth: (first) =>
`Hey ${first}! 👋 Welcome to the MRG family, really excited to work with you on this.

Here's what to expect:

1️⃣ We'll be in touch to start your design consultation and set your monthly benchmarks
2️⃣ Once design is approved, we book your onboarding visit for photos and setup
3️⃣ From there we handle pricing, guest messaging, and everything else

Message here anytime, we're always around 📲
Shane & Ryan, Mandel Realty Group`,
  essentials: (first) =>
`Hey ${first}! 👋 Welcome to MRG, glad to have you with us.

Here's what happens next:

1️⃣ We'll book a quick onboarding visit to set up your cleaner coordination and digital guidebook
2️⃣ We'll get your messaging and guest communication running from there
3️⃣ You'll be all set, and this group is your direct line to us anytime

Looking forward to working with you 📲
Shane & Ryan, Mandel Realty Group`,
};

function ownerFirstName(u){
  const raw = String(u?.owner || '').trim();
  if(!raw || raw === '—' || raw === '-') return 'there';
  return raw.split(/\s+/)[0] || 'there';
}

/** Pick Standard / Growth / Essentials template from unit.plan (and planTier text). */
function waWelcomeKind(u){
  const plan = `${u?.plan || ''} ${u?.planTier || ''}`.toLowerCase();
  if(/essential/.test(plan)) return 'essentials';
  if(/growth|partnership/.test(plan)) return 'growth';
  if(/standard|full[_\s-]?service/.test(plan)) return 'standard';
  return 'standard'; // furniture add-on / unknown → Standard
}

function waWelcomeBadge(kind){
  if(kind === 'growth') return { label: 'Growth Partnership', tone: tone(155, .13) };
  if(kind === 'essentials') return { label: 'Managed Essentials', tone: tone(270, .02) };
  return { label: 'Standard', tone: tone(255, .14) };
}

function waWelcomeMessage(u){
  const kind = waWelcomeKind(u);
  const first = ownerFirstName(u);
  return { kind, first, text: WA_TEMPLATES[kind](first) };
}

function planIsRecognised(u){
  return /standard|full[_\s-]?service|growth|partnership|essential/i.test(String(u?.plan || ''));
}

function whatsappWelcomeHTML(u){
  const { kind, first, text } = waWelcomeMessage(u);
  const badge = waWelcomeBadge(kind);
  const needsNote = !planIsRecognised(u) || first === 'there';
  return `<div class="wawelcome" data-wa="${esc(u.id)}">
    <div class="wahead">
      <div>
        <h5>WhatsApp welcome</h5>
        <p class="wasub">Copy and paste into the group chat after your call with ${esc(first)}</p>
      </div>
      <span class="chip" style="background:${badge.tone.bg};color:${badge.tone.t}">${esc(badge.label)}</span>
    </div>
    ${needsNote ? `<p class="wanote">Set the client name and plan to personalise this message</p>` : ''}
    <div class="wabox">${esc(text)}</div>
    <button type="button" class="btn primary wacopy" data-act="waWelcomeCopy" data-id="${esc(u.id)}">Copy message</button>
  </div>`;
}

const STATUS = {
  progress:{dot:'var(--blue)', label:()=> 'In Progress'},
  waiting: {dot:'var(--amber)',label:()=> 'Waiting Approval', sub:s=>`Waiting on ${s.on}`},
  blocked: {dot:'var(--red)',  label:()=> 'Blocked', sub:s=>s.reason},
  owner:   {dot:'var(--grey)', label:()=> 'Waiting on Owner'},
  done:    {dot:'var(--teal)', label:()=> 'Done'},
  ready:   {dot:'var(--amber)', label:()=> 'Review needed', sub:()=> 'Ready to advance'},
  skipped: {dot:'transparent', label:()=> 'Skipped — N/A', sub:()=> 'Ready to advance', ring:true},
  assign:  {dot:'transparent', label:()=> 'Needs assignment', sub:()=> 'Assign the next stage', ring:true}
};
function statusHTML(u){
  const s=u.status||{k:'progress'}, d=STATUS[s.k]||STATUS.progress;
  if(s.k==='done') return `<div class="status" style="color:${ok(185,.11,.42)};font-weight:600">${ic('check','sm w6')}Done</div>`;
  return `<div class="status"><i class="dot" style="background:${d.dot};${d.ring?'box-shadow:inset 0 0 0 1.5px var(--grey)':''}"></i><div>${d.label(s)}${d.sub?`<small>${esc(d.sub(s))}</small>`:''}</div></div>`;
}
function dueHTML(s, done){
  if(!s) return '<span class="due">Not set</span>';
  const d=diff(s);
  if(done) return `<span class="due">${fmt(s)}</span>`;
  if(d<0) return `<span class="due late">${fmt(s)} · ${-d}d late</span>`;
  if(d===0) return `<span class="due today">Today</span>`;
  return `<span class="due">${fmt(s)}</span>`;
}

let toastT;
function toast(msg){
  const t=$('#toast'); t.innerHTML = ic('check','sm w6')+esc(msg); t.classList.add('show');
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),2200);
}

/* =========================================================
   Nav
   ========================================================= */
function renderNav(){
  const item = n => `<button data-nav="${n.id}" title="${n.label}" class="${ui.nav===n.id?'active':''}" ${ui.nav===n.id?'aria-current="page"':''}>${ic(n.icon)}<span class="nl">${n.label}</span></button>`;
  $('#nav').innerHTML = NAV_GROUPS.map(g=>`<div class="navgroup nav">${g.title?`<h4>${g.title}</h4>`:''}${g.items.map(item).join('')}</div>`).join('');
  $('#navFoot').innerHTML = NAV_FOOT.map(item).join('');
  $('#bottomnav').innerHTML = MOBILE_NAV.map(id=>{ const n=ALL_NAV.find(x=>x.id===id);
    return `<button data-nav="${id}" class="${ui.nav===id?'active':''}" ${ui.nav===id?'aria-current="page"':''}>${ic(n.icon)}${n.label}</button>`;}).join('');
  const cur = ALL_NAV.find(n=>n.id===ui.nav), isOnb = ui.nav==='onboarding';
  $('#pageTitle').textContent = cur.label;
  $('#onboarding').hidden = !isOnb; $('#otherView').hidden = isOnb;
  root.querySelectorAll('[data-cta]').forEach(b=>b.hidden=!isOnb);
  $('#phTitle').textContent = cur.label;
  $('#phText').textContent = cur.id==='copilot' ? 'Copilot lives here as one section of the hub — no separate tab.' : `${cur.label} moves into this hub next. Onboarding is the live section in this mockup.`;
}
function setNav(id){
  const modeMap = {crm:'crm', ops:'ops', clients:'ops', properties:'ops', team:'ops', sops:'ops', copilot:'copilot', settings:'ops', dashboard:'ops', onboarding:'onboarding', revenue:'ops'};
  if(id==='dashboard' && host.go){ host.go('dashboard'); return; }
  if(id!=='onboarding' && host.go && modeMap[id] && modeMap[id]!=='onboarding'){
    if (id === 'clients') { host.go('ops', { opsTab: 'clients' }); return; }
    if (id === 'properties') { host.go('ops', { opsTab: 'properties' }); return; }
    if (id === 'team') { host.go('ops', { opsTab: 'employees' }); return; }
    if (id === 'sops') { host.go('ops', { opsTab: 'sops' }); return; }
    if (id === 'revenue' || id === 'settings') { host.go('ops', { opsTab: id === 'revenue' ? 'month' : 'settings' }); return; }
    host.go(modeMap[id]);
    return;
  }
  ui.nav=id; renderNav(); scrollMain(); if(id!=='onboarding'){ closeModal(); closePop(); }
}

/* =========================================================
   Stats
   ========================================================= */
function renderStats(){
  const active = units.filter(u=>STAGES[u.stage].id!=='live' || u.status.k!=='done').length;
  const attention = units.filter(u=>u.flags>0 || u.status.k==='blocked').length;
  const moving = units.filter(u=>u.status.k!=='done' && u.day<=7).length;
  const liveDays = units.filter(u=>u.status.k==='done').map(u=>u.day);
  const avg = liveDays.length ? Math.round(liveDays.reduce((a,b)=>a+b,0)/liveDays.length) : null;
  $('#unitCount').textContent = units.length;
  $('#stats').innerHTML = `
    <div class="stat"><span class="ic">${ic('building','sm')}</span><div><b>${active}</b><span class="l">Units onboarding</span></div></div>
    <div class="stat ${attention?'alert':''}"><span class="ic">${ic('alert','sm')}</span><div><b>${attention}</b><span class="l">Needs attention</span></div></div>
    <div class="stat"><span class="ic">${ic('hourglass','sm')}</span><div><b>${avg==null?'—':avg}</b><span class="l">Avg days to live</span></div></div>
    <div class="stat"><span class="ic">${ic('trend','sm')}</span><div><b>${moving}</b><span class="l">Moving this week</span></div></div>`;
}

/* =========================================================
   Pipeline
   ========================================================= */
function phasesHTML(u){
  const act=getActiveStages(u), shown=shownStages(u), cur=STAGES[u.stage].id, curPos=act.indexOf(cur);
  return `<div class="phases" aria-label="Stage progress">${PHASES.map(p=>{
    const ids=p.ids.filter(id=>shown.includes(id));
    const live=ids.filter(id=>act.includes(id));
    const done=live.filter(id=>act.indexOf(id)<curPos).length;
    return `<div class="phase" style="--n:${ids.length}"><h5>${p.name}<span>${live.length?`${done}/${live.length}`:'Skipped'}</span></h5><div class="steps">${ids.map(id=>{
      const s=STAGES[SIDX[id]];
      if(!act.includes(id)) return `<div class="step skip" aria-disabled="true" title="${s.name} — skipped on ${esc(u.plan)}${u.furniture&&u.furniture!=='none'?'':' (no furniture program)'}"><span class="c"></span><span class="lbl">${s.name}</span></div>`;
      if(isSkipped(u,id)) return `<button type="button" class="step skip na" data-act="unskip" data-id="${u.id}" data-s="${id}" title="${s.name} — click to undo skip"><span class="c"></span><span class="lbl">${s.name}</span></button>`;
      const pos=act.indexOf(id), cls=pos<curPos?'done':id===cur?'cur':'';
      const note = id==='app' && u.plan==='Essentials' ? '<span class="meta" style="display:block">messaging only</span>' : '';
      return `<div class="step ${cls}" style="--sc:${s.c}"><span class="c">${pos<curPos?ic('check'):''}</span>${s.name}${note}</div>`;
    }).join('')}</div></div>`;
  }).join('')}</div>`;
}
/* "Step X of Y" — same numbering as the expanded detail header */
function stepOf(u){
  const act=getActiveStages(u);
  return `<span class="stepof">Step ${act.indexOf(STAGES[u.stage].id)+1} of ${act.length}</span>`;
}

const hv = v => v ? esc(v) : '<span class="meta">Not set</span>';

/* ---------- Furniture line items: plan → per-line approval → orders ---------- */
const DELIVER = u => [['unit',`To the unit · ${u.addr}`],['ryan',"Ryan's address"],['shane',"Shane's address"]];
const lineTotal = l => l.qty*l.price;
function linesHTML(u, sid=STAGES[u.stage].id, ro=false){
  if(ro && !u.lines.length) return '';
  const mode = sid==='furniture' ? 'plan' : sid==='client' ? 'approve' : sid==='procurement' ? 'orders' : null;
  if(!mode) return '';
  const L = mode==='orders' ? u.lines.filter(l=>l.client==='approved') : u.lines;
  const ryanAll = u.lines.length>0 && u.lines.every(l=>l.ryan);
  const budget = u.lines.filter(l=>l.client!=='declined').reduce((a,l)=>a+lineTotal(l),0);
  const ryanDone=u.lines.filter(l=>l.ryan).length, cliDone=u.lines.filter(l=>l.client!=='pending').length;
  const title = mode==='plan' ? 'Furniture plan' : mode==='approve' ? 'Line-item approval' : 'Orders & delivery';
  const sub = mode==='approve' ? (ryanAll ? `Ryan approved all ${u.lines.length} · client decided ${cliDone} of ${u.lines.length}` : `Ryan approved ${ryanDone} of ${u.lines.length} · client reviews after Ryan`)
            : mode==='orders' ? `${L.length} order${L.length===1?'':'s'} · choose where each is delivered` : `${u.lines.length} item${u.lines.length===1?'':'s'} · ${money(budget)}`;
  const row = l => {
    const item = `<div class="li"><b>${esc(l.item)}</b><span class="meta">${esc(l.room||'')}</span></div>
      <div class="lp"><b>${money(lineTotal(l))}</b><span class="meta">${l.qty} × ${money(l.price)}</span></div>`;
    if(ro){
      if(mode==='plan') return `<li class="lrow m-plan">${item}<span></span></li>`;
      if(mode==='orders') return `<li class="lrow m-orders">${item}<div class="ld meta">${esc(DELIVER(u).find(d=>d[0]===l.deliver)[1])}</div></li>`;
      const rc = l.ryan ? `<span class="lchip ok">${ic('check','sm w6')}Ryan approved</span>` : `<span class="meta">Not approved</span>`;
      const cc = l.client==='pending' ? `<span class="meta">Pending</span>` : `<span class="lchip ${l.client==='approved'?'ok':'no'}">${ic(l.client==='approved'?'check':'x','sm w6')}${l.client==='approved'?'Client OK':'Declined'}</span>`;
      return `<li class="lrow m-approve ${l.client==='declined'?'declined':''}">${item}<div class="lc">${rc}</div><div class="lc">${cc}</div></li>`;
    }
    if(mode==='plan') return `<li class="lrow m-plan">${item}<button class="iconbtn" data-act="lineDel" data-id="${u.id}" data-l="${l.id}" aria-label="Remove ${esc(l.item)}">${ic('x','sm')}</button></li>`;
    if(mode==='orders') return `<li class="lrow m-orders">${item}<div class="ld"><label class="sr" for="dl${l.id}">Deliver ${esc(l.item)} to</label><select class="input" id="dl${l.id}" data-k="deliver" data-id="${u.id}" data-l="${l.id}">${DELIVER(u).map(([k,t])=>`<option value="${k}" ${l.deliver===k?'selected':''}>${esc(t)}</option>`).join('')}</select></div></li>`;
    const ryanCell = l.ryan
      ? `<button class="lchip ok" data-act="lineRyan" data-id="${u.id}" data-l="${l.id}" aria-pressed="true" title="Undo Ryan's approval">${ic('check','sm w6')}Ryan approved</button>`
      : `<button class="btn sm" data-act="lineRyan" data-id="${u.id}" data-l="${l.id}" aria-pressed="false">Ryan approves</button>`;
    const cliCell = !ryanAll ? `<span class="meta">After Ryan</span>`
      : l.client==='pending' ? `<span class="lpair"><button class="btn sm" data-act="lineClient" data-v="approved" data-id="${u.id}" data-l="${l.id}">Client OK</button><button class="btn sm" data-act="lineClient" data-v="declined" data-id="${u.id}" data-l="${l.id}">Declined</button></span>`
      : `<button class="lchip ${l.client==='approved'?'ok':'no'}" data-act="lineClient" data-v="pending" data-id="${u.id}" data-l="${l.id}" title="Undo">${ic(l.client==='approved'?'check':'x','sm w6')}${l.client==='approved'?'Client OK':'Declined'}</button>`;
    return `<li class="lrow m-approve ${l.client==='declined'?'declined':''}">${item}<div class="lc">${ryanCell}</div><div class="lc">${cliCell}</div></li>`;
  };
  const head = mode==='approve' ? `<li class="lrow lhead m-approve"><span>Item</span><span>Total</span><span>Ryan</span><span>Client</span></li>`
             : mode==='orders' ? `<li class="lrow lhead m-orders"><span>Order</span><span>Total</span><span>Deliver to</span></li>` : '';
  const budgetRow = mode==='approve' && u.lines.length ? `
    <div class="lbudget"><div><b>Budget ${money(budget)}</b><span class="meta">${u.lines.filter(l=>l.client==='declined').length?'Declined items excluded':'All items'}</span></div>
      ${ro ? (u.budgetOk ? `<span class="lchip ok">${ic('check','sm w6')}Client approved budget</span>` : '<span class="meta">Budget not approved</span>')
        : !ryanAll ? '<span class="meta">Client approves after Ryan</span>'
        : u.budgetOk ? `<button class="lchip ok" data-act="budget" data-id="${u.id}" title="Undo">${ic('check','sm w6')}Client approved budget</button>`
        : `<button class="btn sm" data-act="budget" data-id="${u.id}">Client approved budget</button>`}
    </div>` : '';
  const add = !ro && (mode!=='orders' || !u.lines.length) ? `
    <div class="lineadd">
      <input class="input" data-k="lItem" placeholder="Item" aria-label="Item">
      <input class="input" data-k="lRoom" placeholder="Room" aria-label="Room">
      <input class="input" data-k="lQty" inputmode="numeric" placeholder="Qty" aria-label="Quantity">
      <input class="input" data-k="lPrice" inputmode="decimal" placeholder="Price each" aria-label="Price each">
      <button class="btn sm" data-act="lineAdd" data-id="${u.id}">Add line</button>
    </div>` : '';
  return `<div class="lines">
    <h5>${ic('clip','sm')}${title}<span class="meta">${sub}</span></h5>
    ${L.length?`<ul class="llist">${head}${L.map(row).join('')}</ul>`:ro?`<div class="lempty">No items.</div>`:`<div class="lempty">${mode==='orders'?'No approved items yet — add orders below.':'No line items yet — add the first one below.'}</div>`}
    ${budgetRow}${add}
  </div>`;
}
function syncClient(u){
  if(STAGES[u.stage].id!=='client') return;
  const L=u.lines, ryanAll=L.length>0 && L.every(l=>l.ryan);
  const clientAll=ryanAll && L.every(l=>l.client!=='pending') && L.some(l=>l.client==='approved') && u.budgetOk;
  u.tasks.forEach(t=>{ if(t.special==='ryanlines') t.done=ryanAll; if(t.special==='clientlines') t.done=clientAll;
    if(AUTO.includes(t.special)){ if(t.done && !t.doneAt && ui && ui.booted){ t.doneAt=nowISO(); t.doneBy=t.special==='ryanlines'?'ryan':'admin'; } if(!t.done){ delete t.doneAt; } } });
}
function refreshStatus(u, announce){
  syncClient(u);
  if(isSkipped(u, STAGES[u.stage].id)) return;
  const ready=stageReady(u), sid=STAGES[u.stage].id;
  if(ready && ['progress','blocked','owner','waiting'].includes(u.status.k)){
    u.status={k:'ready'};
    if(announce) toast(ownerCount(u.tasks)?`Ready to advance — ${ownerLabel(ownerCount(u.tasks))}`:'All tasks done — ready to advance');
  } else if(!ready){
    if(sid==='client'){
      const sent=u.tasks.find(t=>t.special==='sent'), ryanT=u.tasks.find(t=>t.special==='ryanlines');
      if(sent&&sent.done&&ryanT&&ryanT.done){ if(u.status.k!=='blocked') u.status={k:'waiting',on:'Client'}; }
      else if(['ready','waiting'].includes(u.status.k)) u.status={k:'progress'};
    } else if(u.status.k==='ready') u.status={k:'progress'};
  }
}
const ownerCount = tasks => tasks.filter(t=>t.who==='owner'&&!t.done&&!t.na).length;
const ownerLabel = n => `${n} owner step${n===1?'':'s'} pending`;
function ownerPendingHead(u){ const n=ownerCount(u.tasks); return n && u.tasks.filter(t=>t.who!=='owner').every(t=>t.done||t.na) ? ' · '+ownerLabel(n) : ''; }
const stageReady = u => u.tasks.filter(t=>t.who!=='owner').every(t=>t.done || t.na);
const isSkipped = (u,sid) => !!(u.skipped && u.skipped[sid]);
function nextStageId(u){ const act=getActiveStages(u), pos=act.indexOf(STAGES[u.stage].id); return act.slice(pos+1).find(id=>!isSkipped(u,id)) || null; }
function stageTasks(u, sid){
  const cur=STAGES[u.stage].id, act=getActiveStages(u);
  if(sid===cur) return u.tasks;
  if(act.indexOf(sid) < act.indexOf(cur)){
    // past: what was recorded when the stage was advanced, else the template marked done
    return (u.past && u.past[sid]) || makeTasks(sid,u,0).map(t=>({...t, done:true, due:null}));
  }
  // future: prefer the single scheduled copy from the host; template is preview-only when none exist yet
  const scheduled = (u.extra && u.extra[sid]) || [];
  if(scheduled.length) return scheduled;
  return makeTasks(sid,u,0).map(t=>({...t, due:null}));
}
function stageTabs(u, sel){
  const act=getActiveStages(u), cur=STAGES[u.stage].id, curPos=act.indexOf(cur), live=u.status.k==='done';
  return `<div class="stabs" role="tablist" aria-label="Stages"><button class="stab ho ${sel==='handoff'?'sel':''}" role="tab" aria-selected="${sel==='handoff'}" data-act="tab" data-id="${u.id}" data-s="handoff" style="--sc:var(--ink)">${ic('clip','sm')}Handoff</button>${act.map((id,pos)=>{
    const st=STAGES[SIDX[id]];
    let state = pos<curPos || (live && id===cur) ? 'past' : id===cur ? 'cur' : 'future';
    let mark = state==='past' ? ' ✓' : state==='cur' ? ' →' : '';
    if(isSkipped(u,id)){ mark = id===cur ? ' · N/A →' : ' · N/A'; state += ' na'; }
    return `<button class="stab ${state} ${id===sel?'sel':''}" role="tab" aria-selected="${id===sel}" data-act="tab" data-id="${u.id}" data-s="${id}" style="--sc:${st.c}"><i class="d"></i>${st.name}${mark}</button>`;
  }).join('')}</div>`;
}
/* What the unit page overlay (OnboardingApp → UnitPage) needs for its header. */
function unitTarget(u, tab){
  const act=getActiveStages(u);
  return { unitId:String(u.id), cleanerPropertyId:u.cleanerPropertyId||'', address:u.addr||u.address||'', tab,
    type:formatType(u.type||''), owner:u.owner&&u.owner!=='—'?u.owner:'', plan:u.plan||'',
    step:`Step ${act.indexOf(STAGES[u.stage].id)+1} of ${act.length}` };
}
function auditAgo(at){
  if(!at) return '';
  const ms=Date.parse(at); if(!Number.isFinite(ms)) return '';
  const s=Math.max(0,Math.round((Date.now()-ms)/1000));
  if(s<45) return 'just now';
  const m=Math.round(s/60); if(m<60) return `${m} min ago`;
  const h=Math.floor(m/60); return `${h}h ${m%60}m ago`;
}
function isAuditChecklistTask(t){ return /Onboarder completes audit/i.test(t.name||''); }
function stravoLinkHTML(u){
  const linked=!!(u.cleanerPropertyId||'').trim();
  if(!linked){
    return `<div class="audit-nl"><div><b>⚠ Not linked to Stravo portal</b><p>Link this unit to connect the onboarder checklist.</p><button type="button" class="btn sm amber" data-act="stravoOpen" data-id="${u.id}">Link to Stravo →</button></div></div>`;
  }
  return `<div class="audit-ln"><span class="dot8" aria-hidden="true"></span><b>Linked to Stravo</b><button type="button" class="mlink" data-act="stravoOpen" data-id="${u.id}">Change</button></div>`;
}
function auditPanelHTML(u, live){
  const linked=!!(u.cleanerPropertyId||'').trim();
  const first=whoName(u.assignee).split(/\s+/)[0]||'onboarder';
  const sent=u.portalLinkSentAt;
  let sendRow;
  if(sent){
    sendRow=`<div class="audit-prow sent"><span>✓ <b>Portal link sent</b> · ${esc(auditAgo(sent)||relTime(sent))}</span><span class="r"><button type="button" class="btn sm ghost" data-act="auditSendPortal" data-id="${u.id}">Resend →</button></span></div>`;
  } else {
    sendRow=`<div class="audit-prow"><span>Send ${esc(first)} their portal link</span><span class="r"><button type="button" class="btn sm primary" data-act="auditSendPortal" data-id="${u.id}">Send ${esc(first)} their portal link →</button></span></div>`;
  }
  if(!linked){
    return `<div class="audit-panel">${sendRow}<div class="audit-hr"></div><div class="audit-empty">Link to Stravo first. Live progress shows here once the onboarder starts.</div></div>`;
  }
  const answered=live?.answeredItems??0, total=live?.totalItems??0, pct=total>0?Math.min(100, Math.round((answered/total)*100)):0;
  const name=live?.answeredBy||whoName(u.assignee)||'Onboarder';
  let status;
  if(total>0 && answered>=total) status=`<span class="d g"></span><b>${esc(name)}</b> · Finished the checklist`;
  else if(live?.isActive) status=`<span class="d g"></span><b>${esc(name)}</b> · Active now`;
  else if(answered>0 || live?.lastActivity) status=`<span class="d a"></span><b>${esc(name)}</b> · No activity ${live?.idleMinutes!=null?`${live.idleMinutes}m`:'—'}`;
  else status=`<span class="d n"></span>Not started yet`;
  const flags=(live?.flags||[]).filter(f=>!f.acknowledged);
  const flagChip=flags.length?`<span class="audit-chip red">${flags.length} flag${flags.length===1?'':'s'} to review</span>`:'<span></span>';
  return `<div class="audit-panel">${sendRow}<div class="audit-hr"></div>
    <div class="audit-plbl">Live progress<span><b>${answered} / ${total||'—'}</b>${total?` · ${pct}%`:''}</span></div>
    <div class="audit-pbar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
    <div class="audit-os">${status}</div>
    <div class="audit-open">${flagChip}<button type="button" class="btn sm" data-act="auditViewAll" data-id="${u.id}">Open full progress →</button></div>
  </div>`;
}
function auditTasksHTML(u, list, ro, view){
  const live=ui.intakeLive[u.id]||null;
  /* Load progress as soon as the Audit tab shows, so expanding the task is instant. */
  if(!live && (u.cleanerPropertyId||'').trim()){
    ui.intakePrefetch=ui.intakePrefetch||{};
    if(!ui.intakePrefetch[u.id]){ ui.intakePrefetch[u.id]=true; setTimeout(()=>loadAuditIntake(u.id),0); }
  }
  const answered=live?.answeredItems??0;
  const total=live?.totalItems??0;
  // Done only when the onboarder's whole checklist is done (the total comes from their phone; 0 until setup).
  const complete=total>0 && answered>=total;
  const expanded=!!ui.auditExp[u.id];
  const tasks=list.map((t,i)=>{
    const auditTask=isAuditChecklistTask(t);
    const done=auditTask ? (t.done || complete) : t.done;
    const dueTxt = t.na ? '' : !t.due ? '' : `<span class="tdue ${!done&&diff(t.due)<0?'late':''}">${!done&&diff(t.due)===0?'Today':fmt(t.due)}</span>`;
    if(auditTask){
      const chip=complete?`<span class="audit-pc ok">Complete</span>`:`<span class="audit-pc ${answered?'live':''}">${answered} / ${total||'—'}</span>`;
      return `<li class="${done?'done':''}">
        <label title="Checks itself when the onboarder's checklist is complete"><input type="checkbox" disabled ${done?'checked':''}><span class="tn">${esc(t.name)}</span></label>
        ${avatar(t.who,u,'sm')}${dueTxt}${chip}
        <button type="button" class="audit-exp" data-act="auditToggle" data-id="${u.id}" aria-expanded="${expanded}" aria-label="${expanded?'Collapse':'Expand'} audit progress">${ic('chev','sm')}</button>
        ${expanded?auditPanelHTML(u, live):''}
      </li>`;
    }
    const ownerTask = t.who==='owner' && !t.done && !t.na;
    const naBtn = (t.who==='owner' || ro) ? (t.na ? `<span class="nalbl">${t.auto_na?'N/A · tier':'N/A'}</span>` : '')
      : `<button class="nabtn ${t.na?'on':''}" data-act="taskNA" data-id="${u.id}" data-i="${i}" aria-pressed="${!!t.na}" title="${t.na?'Restore task':'Mark not applicable'}">N/A</button>`;
    return `
    <li class="${t.done?'done':''} ${t.na?'na':''} ${ownerTask?'owner':''} ${ro?'ro':''}">
      ${t.na
        ? `<div class="ownrow"><span class="nadash" aria-hidden="true">—</span><span class="tn">${esc(t.name)}</span>${t.link?appLink():''}${t.done&&t.doneAt?`<span class="tdone">${esc(whoName(t.doneBy))} · ${relTime(t.doneAt)}</span>`:''}</div>`
        : ownerTask
        ? `<div class="ownrow"><i class="dot" style="background:var(--grey)"></i><span class="tn">${esc(t.name)}</span>${t.link?appLink():''}<span class="owntag">Waiting on owner</span></div>`
        : (ro || AUTO.includes(t.special))
          ? `<label ${ro?'title="Read-only"':''}><input type="checkbox" disabled ${t.done?'checked':''}><span class="tn">${esc(t.name)}</span>${t.link?appLink():''}${!ro?'<span class="owntag">Auto</span>':''}</label>`
          : `<label><input type="checkbox" data-act="task" data-id="${u.id}" data-i="${i}" ${t.id?`data-task-id="${t.id}"`:''} ${t.done?'checked':''}><span class="tn">${esc(t.name)}</span>${t.link?appLink():''}${t.done&&t.doneAt?`<span class="tdone">${esc(whoName(t.doneBy))} · ${relTime(t.doneAt)}</span>`:''}</label>`}
      ${avatar(t.who,u,'sm')}${dueTxt}${naBtn}
    </li>`;}).join('');
  return `${stravoLinkHTML(u)}<ul class="tasks">${tasks}</ul>`;
}
function stravoModalHTML(){
  const m=ui.stravoModal; if(!m) return '';
  const rows=(m.results||[]).map(p=>`<li><div><b>${esc(p.name)}</b><small>${esc(p.address||'portal.stravo.ai')}</small></div><button type="button" class="btn sm" data-act="stravoLink" data-id="${esc(m.unitId)}" data-pid="${esc(p.id)}">Link →</button></li>`).join('');
  return `<div class="audit-modal-scrim" data-act="stravoClose"><div class="audit-modal" role="dialog" aria-modal="true" aria-labelledby="stravoTitle" data-stop>
    <h2 id="stravoTitle">Link to Stravo</h2>
    <p class="lede">Search for the matching property in the Stravo portal.</p>
    <input class="input" data-k="stravoQ" data-id="${esc(m.unitId)}" value="${esc(m.q||'')}" placeholder="Search Stravo properties" aria-label="Search Stravo properties" autocomplete="off">
    <ul class="audit-res">${m.loading?`<li class="none" style="justify-content:center;color:var(--muted)">Searching…</li>`: rows || `<li style="justify-content:center;color:var(--muted)">No Stravo properties match</li>`}</ul>
    <div style="display:flex;justify-content:flex-end;margin-top:12px"><button type="button" class="btn ghost" data-act="stravoClose">Cancel</button></div>
  </div></div>`;
}
function stopAuditPoll(){ if(auditPollTimer){ clearInterval(auditPollTimer); auditPollTimer=null; } }
function ensureAuditPoll(){
  stopAuditPoll();
  const openId=Object.keys(ui.auditExp).find(id=>ui.auditExp[id]);
  if(!openId) return;
  let n=0;
  const tick=()=>{
    if(document.visibilityState!=='visible') return;
    const u=unitById(openId); if(!u || !ui.auditExp[openId]){ stopAuditPoll(); return; }
    n+=1;
    // Light check every 20s; full payload every 2 min (the cleaner database is small, keep the load down).
    loadAuditIntake(openId, n%6!==0);
  };
  auditPollTimer=setInterval(tick, 20000);
}
function loadAuditIntake(unitId, streamOnly){
  const u=unitById(unitId); if(!u) return Promise.resolve();
  if(!(u.cleanerPropertyId||'').trim()){ ui.intakeLive[unitId]=null; renderPipeline(); return Promise.resolve(); }
  const get = host.get || ((q)=>fetch('/api/admin/pm?'+new URLSearchParams({resource:'onboarding',...q}),{credentials:'include'}).then(r=>r.json()));
  const q = streamOnly
    ? { op:'intake_progress', unitId, stream:'1' }
    : { op:'intake_progress', unitId };
  return get(q).then(data=>{
    if(streamOnly){
      const prev=ui.intakeLive[unitId]||{};
      ui.intakeLive[unitId]={
        ...prev,
        answeredItems: data.answeredItems ?? prev.answeredItems ?? 0,
        isActive: !!data.isActive,
        lastActivity: data.lastActivityAt ?? prev.lastActivity ?? null,
        totalItems: data.totalItems ?? prev.totalItems ?? 0,
        progress: (data.totalItems ?? prev.totalItems) > 0 ? Math.min(100, Math.round(((data.answeredItems ?? 0)/(data.totalItems ?? prev.totalItems))*100)) : 0,
      };
    } else {
      ui.intakeLive[unitId]=data;
    }
    const live=ui.intakeLive[unitId];
    const auditTask=(u.tasks||[]).find(isAuditChecklistTask);
    if(live && live.totalItems>0 && live.answeredItems>=live.totalItems && auditTask && !auditTask.done && auditTask.id){
      act('toggle_task', { id: auditTask.id, done: true, done_by: 'System' });
      return;
    }
    renderPipeline();
  }).catch(err=>{ if(host.onError) host.onError(err); });
}
function skipUI(u, sid, isNA){
  if(isNA || sid==='live' || u.status.k==='done') return '';
  const st=STAGES[SIDX[sid]];
  if(ui.skipAsk[u.id]===sid) return `<div class="skipask" role="alertdialog" aria-label="Confirm skip">
      <span>Skip <b>${st.name}</b>? This marks it as not needed.</span>
      <span class="skipbtns"><button class="btn sm danger" data-act="skipYes" data-id="${u.id}" data-s="${sid}">Confirm</button><button class="btn sm ghost" data-act="skipNo" data-id="${u.id}">Cancel</button></span>
    </div>`;
  return `<div class="skiprow"><button class="btn sm ghost" data-act="skipStage" data-id="${u.id}" data-s="${sid}">Mark as not applicable →</button></div>`;
}
const ACCESS_OPTS = ['Lockbox','Smart lock','Keypad','Physical key','Key fob','Front desk','Other'];
function normHandoff(h){
  h = h || {};
  const map={'Key handoff':'Physical key','Concierge / front desk':'Front desk'};
  if(map[h.access]) h.access=map[h.access];
  if(h.alarm && h.alarm!=='None' && h.alarm!=='Has alarm'){
    if(/^none$/i.test(h.alarm.trim())) h.alarm='None'; else { h.alarmInfo = h.alarmInfo || h.alarm; h.alarm='Has alarm'; }
  }
  return h;
}
const alarmText = h => !h.alarm ? '' : h.alarm==='None' ? 'None' : `Has alarm${h.alarmInfo?` — ${h.alarmInfo}`:''}`;
const PERMIT_TONE = {'Active':[155,.13],'Applied':[65,.14],'Expired':[25,.18],'Not required':[270,.02]};
function historyHTML(u){
  const H=[...(u.history||[])].sort((a,b)=>b.ts.localeCompare(a.ts));
  if(!H.length) return '';
  const all=ui.histAll.has(u.id), list=all?H:H.slice(0,7);
  return `<div class="hist"><h5>${ic('clock','sm')}History <span class="count">${H.length}</span></h5>
    <ul>${list.map(e=>`<li><span>${esc(e.text)}</span><span class="meta">${relTime(e.ts)}</span></li>`).join('')}</ul>
    ${H.length>7?`<button class="btn sm ghost" data-act="histAll" data-id="${u.id}">${all?'Show less':`Show all ${H.length}`}</button>`:''}</div>`;
}
function factsRow(u){
  const h=u.handoff||{}, pt=PERMIT_TONE[h.permit], tn=pt?tone(pt[0],pt[1]):null;
  const permit = h.permit ? `<span class="chip" style="background:${tn.bg};color:${tn.t}">${esc(h.permit)}</span>` : `<span class="chip" style="background:oklch(0.6 0.015 270 / .14);color:var(--ink2)">No permit status</span>`;
  const fipBad = u.furniture==='fip' && (!h.strLicence || h.permit!=='Active');
  const planTxt = [u.plan, furnText(u)].filter(Boolean).join(' · ');
  return `<div class="factsrow">
    <span><b>${esc(u.addr)}</b></span><span>${esc(formatType(u.type))}</span>
    <span>CRM: ${u.leadId?`<button type="button" class="linkbtn tl" data-act="openLeadFromUnit" data-l="${esc(u.leadId)}">${esc(u.leadName||'Open lead')}${u.leadSource?` · ${esc(u.leadSource)}`:''} →</button>`:'<span class="meta">Not linked</span>'}</span><span>${esc(planTxt)}</span>
    <span>STR: ${h.strLicence?`<b>${esc(h.strLicence)}</b>`:'<span class="meta">Not on file</span>'}</span>${permit}
    <span>Hospitable ID: ${h.hospId?`<b>${esc(h.hospId)}</b>`:'<span class="meta">Not yet set</span>'}</span>
    <span>Airbnb: ${h.airbnbUrl?`<a class="applink" style="margin:0" href="${esc(h.airbnbUrl)}" target="_blank" rel="noopener">Open listing →</a>`:'<span class="meta">Not yet set</span>'}</span>
    ${fipBad?`<span class="chip warnchip">${ic('alert','sm')}FIP needs active STR permit</span>`:''}
    ${u.docs.some(d=>d.tag==='agreement')?'':`<span class="chip amberchip">${ic('alert','sm')}No management agreement on file</span>`}
  </div>`;
}
/* sensitive values are masked until revealed (per session, not stored) */
const revealed = new Set();
function masked(u, key, val){
  if(!val) return '<span class="meta">Not set</span>';
  const k=`${u.id}:${key}`, on=revealed.has(k);
  return `<span class="mask">${on?esc(val):'<span class="dots">••••••••</span>'}<button type="button" class="eyebtn" data-act="reveal" data-k="${k}" aria-pressed="${on}" aria-label="${on?'Hide':'Reveal'}">${on?'<svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.7 8.5 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 4.4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>':'<svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'}<span>${on?'Hide':'Tap to reveal'}</span></button></span>`;
}
function handoffHTML(u){
  const h=u.handoff, edit=ui.hoEdit.has(u.id), id=u.id;
  const row=(k,v)=>`<dt>${k}</dt><dd>${v?esc(v):'<span class="meta">Not set</span>'}</dd>`;
  const conc=[h.cName,h.cPhone,h.cHours].filter(Boolean).join(' · ');
  const feeTxt = h.fee==='Charged' ? `Charged — ${h.feeAmount?money(parseFloat(h.feeAmount)||0):'amount not set'}` : h.fee==='Waived' ? `Waived${h.feeReason?` — ${h.feeReason}`:''}` : h.fee==='TBC' ? 'To be confirmed' : '';
  // edit-mode field builders
  const inp=(k,label,o={})=>`<div class="field ${o.full?'full':''}"><label for="ho-${k}-${id}">${label}${o.opt?' <em>(optional)</em>':''}</label><input class="input" id="ho-${k}-${id}" data-ho="${k}" ${o.type?`type="${o.type}"`:''} ${o.mode?`inputmode="${o.mode}"`:''} value="${esc(k==='ownerName'?u.owner:(h[k]||''))}" placeholder="${o.ph||''}" autocomplete="off">${o.note?`<div class="hint">${o.note}</div>`:''}</div>`;
  const sel=(k,label,opts,o={})=>`<div class="field ${o.full?'full':''}"><label for="ho-${k}-${id}">${label}</label><select class="input" id="ho-${k}-${id}" data-ho="${k}"><option value="">Choose…</option>${opts.map(x=>`<option ${h[k]===x?'selected':''}>${x}</option>`).join('')}</select></div>`;
  const pw=(k,label,ph)=>{ const on=revealed.has(id+':'+k); return `<div class="field"><label for="ho-${k}-${id}">${label}</label><div class="pwfield"><input class="input" id="ho-${k}-${id}" type="${on?'text':'password'}" data-ho="${k}" value="${esc(h[k]||'')}" placeholder="${ph||''}" autocomplete="off"><button type="button" class="eyebtn in" data-act="reveal" data-k="${id}:${k}" aria-label="Show or hide">${on?'<svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.7 8.5 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 4.4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>':'<svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'}</button></div></div>`; };
  const sec=t=>`<h6 class="hosec full">${t}</h6>`;
  const body = edit ? `
    <div class="hoform">
      ${sec('Owner contact')}
      ${inp('ownerName','Client / owner name')}
      ${inp('whatsapp','Client WhatsApp number',{mode:'tel',ph:'Any format'})}
      ${sel('contactPref','Preferred contact method',['WhatsApp','Email','Phone'])}
      ${sec('Unit access')}
      ${sel('access','Method',ACCESS_OPTS)}
      ${inp('accessLoc','Location',{ph:'e.g. on door handle, left side'})}
      ${pw('entry','Code or instructions','e.g. 4821, or code sent 24h before check-in')}
      ${sel('alarm','Alarm',['None','Has alarm'])}
      ${pw('alarmInfo','Arm / disarm instructions','Only if there is an alarm')}
      ${sec('Building access <em class="secopt">if applicable</em>')}
      ${sel('bldMethod','Building entry method',['Fob','Buzzer code','Concierge','Open lobby','Other'])}
      ${pw('bldCode','Building code or instructions','e.g. buzzer 1402, then #')}
      ${inp('fobCount','Fob count',{mode:'numeric',ph:'How many fobs exist'})}
      ${sec('Parking access <em class="secopt">if applicable</em>')}
      ${inp('parking','Parking spot number',{ph:'e.g. P2, spot 114'})}
      ${sel('parkMethod','Parking access method',['Fob','Code','Open','Other'])}
      ${pw('parkCode','Parking code','')}
      ${sec('Building rules')}
      ${sel('elevator','Elevator booking required',['Yes','No'])}
      ${inp('movingHours','Moving hours',{ph:'e.g. Mon–Sat 8am–5pm only'})}
      ${sel('coi','Certificate of insurance for contractors',['Yes','No'])}
      ${inp('bmContact','Building manager name and phone',{ph:'e.g. Dana Lee · (416) 555-0100'})}
      <div class="field full"><label for="ho-buildingNotes-${id}">Other building notes</label><textarea class="input" id="ho-buildingNotes-${id}" data-ho="buildingNotes">${esc(h.buildingNotes||'')}</textarea></div>
      ${sec('Wifi')}
      ${inp('wifi','Wifi network')}
      ${pw('wifiPw','Wifi password','')}
      ${sec('Concierge')}
      ${inp('cName','Concierge name',{opt:true})}
      ${inp('cPhone','Concierge phone',{mode:'tel'})}
      ${inp('cHours','Concierge hours',{full:true,ph:'e.g. 7am – 11pm daily'})}
      ${sec('Listings')}
      ${inp('existingUrl','Existing Airbnb listing URL',{opt:true,type:'url',full:true,ph:'https://www.airbnb.ca/rooms/…',note:'Required for Growth plan — Rita uses this to pull benchmark revenue data'})}
      ${inp('hospId','Hospitable property ID',{ph:'Filled during Software Setup'})}
      ${inp('airbnbUrl','Airbnb listing URL',{type:'url',ph:'Filled during Software Setup'})}
      ${sec('Licensing & furniture')}
      ${inp('strLicence','STR licence number')}
      ${sel('permit','Permit status',['Not required','Applied','Active','Expired'])}
      <fieldset class="furn full ${['Standard','Full Service'].includes(u.plan)?'':'disabled'}" data-furnbox="${id}"><legend>Furniture program</legend>${furnOptsHTML('hoFurn'+id, u)}</fieldset>
      <div class="field full"><label for="ho-issues-${id}">Known issues</label><textarea class="input" id="ho-issues-${id}" data-ho="issues">${esc(h.issues||'')}</textarea></div>
      ${sec('Onboarding fee')}
      <div class="field full feeset" role="radiogroup" aria-label="Onboarding fee">
        <label class="furnopt"><input type="radio" name="hoFee${id}" data-ho="fee" value="Charged" ${h.fee==='Charged'?'checked':''}><span><b>Charged</b></span>
          <span class="feein">$<input class="input" data-ho="feeAmount" inputmode="decimal" value="${esc(h.feeAmount||'')}" placeholder="Amount" aria-label="Fee amount"></span></label>
        <label class="furnopt"><input type="radio" name="hoFee${id}" data-ho="fee" value="Waived" ${h.fee==='Waived'?'checked':''}><span><b>Waived</b></span>
          <span class="feein">Reason <input class="input" data-ho="feeReason" value="${esc(h.feeReason||'')}" placeholder="Why it was waived" aria-label="Waived reason"></span></label>
        <label class="furnopt"><input type="radio" name="hoFee${id}" data-ho="fee" value="TBC" ${h.fee==='TBC'?'checked':''}><span><b>To be confirmed</b></span></label>
      </div>
      <div class="full hoacts"><button class="btn ghost" data-act="hoCancel" data-id="${id}">Cancel</button><button class="btn primary cta-go" data-act="hoSave" data-id="${id}"><span class="lbl">Save handoff</span>${swapIcon('arrow','check')}</button></div>
    </div>` : `
    <div class="hoview">
      <h6>Owner contact</h6><dl class="hodl">${row('Client / owner',u.owner)}${row('WhatsApp',h.whatsapp?'+1 '+h.whatsapp:'')}${row('Preferred contact',h.contactPref)}</dl>
      <h6>Unit access</h6><dl class="hodl">${row('Method',h.access)}${row('Location',h.accessLoc)}<dt>Code or instructions</dt><dd>${masked(u,'entry',h.entry)}</dd><dt>Alarm</dt><dd>${h.alarm==='Has alarm' && h.alarmInfo ? masked(u,'alarmInfo',h.alarmInfo) : hv(alarmText(h))}</dd></dl>
      <h6>Building access</h6><dl class="hodl">${row('Entry method',h.bldMethod)}<dt>Code or instructions</dt><dd>${masked(u,'bldCode',h.bldCode)}</dd>${row('Fob count',h.fobCount)}</dl>
      <h6>Parking access</h6><dl class="hodl">${row('Spot number',h.parking)}${row('Access method',h.parkMethod)}<dt>Parking code</dt><dd>${masked(u,'parkCode',h.parkCode)}</dd></dl>
      <h6>Building rules</h6><dl class="hodl">${row('Elevator booking',h.elevator)}${row('Moving hours',h.movingHours)}${row('Contractor insurance (COI)',h.coi)}${row('Building manager',h.bmContact)}${row('Other notes',h.buildingNotes)}</dl>
      <h6>Wifi & concierge</h6><dl class="hodl">${row('Wifi',h.wifi)}<dt>Wifi password</dt><dd>${masked(u,'wifiPw',h.wifiPw)}</dd>${row('Concierge',conc)}</dl>
      <h6>Listings</h6><dl class="hodl">${row('Existing Airbnb listing',h.existingUrl)}${row('Hospitable property ID',h.hospId)}${row('Airbnb listing URL',h.airbnbUrl)}</dl>
      <h6>Licensing, furniture & fee</h6><dl class="hodl">${row('STR licence',h.strLicence)}${row('Permit status',h.permit)}${row('Furniture program',furnText(u)||'None')}${row('Known issues',h.issues)}${row('Onboarding fee',feeTxt)}</dl>
    </div>`;
  return `<div class="dwrap" data-detail="${id}">
    <div class="dhead"><h4>Handoff<span class="meta">Access and setup details for ${esc(u.addr)}</span></h4>
      ${edit?'':`<div class="dacts"><button class="btn" data-act="hoEdit" data-id="${id}">Edit</button></div>`}</div>
    <div class="dbody">
      ${phasesHTML(u)}
      ${factsRow(u)}
      ${stageTabs(u,'handoff')}
      ${body}
      ${historyHTML(u)}
    </div>
  </div>`;
}
function detailHTML(u){
  if(ui.tab[u.id]==='handoff') return handoffHTML(u);
  if(ui.tab[u.id]==='intake'){ ui.tab[u.id]=STAGES[u.stage].id; }
  const s = STAGES[u.stage];
  const act = getActiveStages(u);
  const selId = (ui.tab[u.id] && act.includes(ui.tab[u.id])) ? ui.tab[u.id] : s.id;
  const isNA = isSkipped(u, selId);
  const sel = STAGES[SIDX[selId]];
  const view = selId===s.id ? 'current' : act.indexOf(selId) < act.indexOf(s.id) ? 'past' : 'future';
  const ro = view!=='current';
  const list = stageTasks(u, selId);
  const done = list.filter(t=>t.done||t.na).length;
  const isLiveStep = s.id==='live';
  const showAppr = !ro && u.status.k==='waiting' && s.id!=='client';
  const stageNote = selId==='photo' ? ' · Ryan shoots the final photos' : '';
  const deliverPills = selId==='procurement' ? `<div class="delivrow"><span class="meta">Deliver to:</span>${[['unit','Unit address'],['ryan',"Ryan's address"],['shane',"Shane's address"]].map(([k,t])=>{ const on=(u.deliverTo||'unit')===k;
      return view==='past' ? (on?`<span class="dpill on">${t}</span>`:'') : `<button class="dpill ${on?'on':''}" data-act="deliverTo" data-v="${k}" data-id="${u.id}" aria-pressed="${on}">${t}</button>`; }).join('')}</div>` : '';
  const stageSub = selId==='client' ? `<button class="hilink" data-act="openUnitTab" data-tab="review" data-id="${u.id}">${ic('clip','sm')}Open client review →</button>`
    : selId==='live' ? `<button class="hilink" data-act="openUnitTab" data-tab="golive" data-id="${u.id}">${ic('check','sm')}Open go-live check →</button>`
    : selId==='app' ? `<span class="stagenote">Onboarder's second visit to the property · ${appLink()}</span>`
    : selId==='furniture' ? `${u.furniture==='client'?`<span class="stagenote">Client budget: ${money(u.furnitureBudget||0)}</span>`:''}${u.docs.some(d=>/floor[\s_-]?plan|magicplan/i.test(d.name))
          ? `<button class="hilink" data-act="toDocs" data-id="${u.id}">${ic('file','sm')}Floor plan available in Docs →</button>`
          : `<span class="warnline">${ic('alert','sm')}No floor plan on file — upload in Docs before sourcing</span>`}`
    : (selId==='benchmark' && u.plan==='Growth' && !u.handoff.existingUrl) ? `<span class="warnline">${ic('alert','sm')}Existing listing URL needed to set benchmarks — add in Handoff</span>`
    : '';
  const viewTag = isNA ? 'Skipped — not applicable' : view==='past' ? 'Completed · read-only' : view==='future' ? 'Upcoming · preview' : `${done} of ${list.length} tasks done`;
  const head = `<div class="dhead">
      <div><h4>${sel.name}<span class="meta">Stage ${act.indexOf(selId)+1} of ${act.length} · ${viewTag}${stageNote}${ro?'':ownerPendingHead(u)}</span></h4>${stageSub}${deliverPills}</div>
      ${showAppr?`<div class="dacts">
        <button class="btn" data-act="changes" data-id="${u.id}">Request Changes</button>
        <button class="btn primary cta-go" data-act="approve" data-id="${u.id}"><span class="lbl">${isLiveStep?'Mark Live':'Approve'}</span>${swapIcon('arrow','check')}</button>
      </div>`:''}
    </div>`;
  const nextId = nextStageId(u), next = nextId ? STAGES[SIDX[nextId]] : null;
  const ownerN = ownerCount(u.tasks);
  const defWho = nextId==='software' ? (Object.entries(TEAM).find(([,m])=>/^Shane\b/i.test(m.name))||['shane'])[0] : u.assignee;
  const defDue = u.due ? parse(u.due) : addDays(TODAY,3);
  const advance = !ro && ['ready','skipped'].includes(u.status.k) ? `
    <div class="advance">
      <h5>${next ? `Advance to ${next.name}` : 'Mark this unit live'}</h5>
      ${ownerN ? `<div class="hint"><i class="dot" style="background:var(--grey)"></i>${ownerLabel(ownerN)} — doesn’t block advancing</div>` : ''}
      <div class="advrow">
        ${next ? `<div class="field"><label for="nw${u.id}">Assign to</label><select class="input" id="nw${u.id}" data-k="nextWho">${assignable().map(([k,m])=>`<option value="${k}" ${k===defWho?'selected':''}>${m.name}</option>`).join('')}</select>${teamNoteHTML()}</div>
        <div class="field"><label for="nd${u.id}">Due</label><div class="datefield"><input class="input" id="nd${u.id}" data-k="nextDue" data-date value="${fmtLong(defDue)}" autocomplete="off"><button type="button" class="dfbtn" data-dp tabindex="-1" aria-label="Open calendar"><svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg></button></div></div>` : ''}
        <button class="btn primary cta-go" data-act="advance" data-id="${u.id}"><span class="lbl">${next ? `Start ${next.name}` : 'Mark Live'}</span>${swapIcon('arrow','check')}</button>
      </div>
      <div><button class="btn ghost" data-act="changesOpen" data-id="${u.id}" aria-expanded="${ui.changes.has(u.id)}">Request changes</button></div>
      ${ui.changes.has(u.id) ? `<div class="advrow"><input class="input" style="flex:1;min-width:200px" data-k="changeNote" data-id="${u.id}" placeholder="What needs changing?" aria-label="What needs changing"><button class="btn" data-act="changesSend" data-id="${u.id}">Send back</button></div>` : ''}
    </div>` : '';
  const isFloor = d => /floor[\s_-]?plan|magicplan/i.test(d.name);
  const sdocs = u.docs.map((d,i)=>({d,i})).filter(x=>x.d.stage===selId || (selId==='furniture' && isFloor(x.d)));
  const docs = (ro && !sdocs.length) ? '' : `
    <div class="docs" id="docs-${u.id}">
      <h5>${ic('clipx','sm')}Documents <span class="count">${sdocs.length}</span></h5>
      ${sdocs.length ? `<ul class="doclist">${sdocs.map(({d,i})=>`
        <li>${ic('file','sm')}<span class="dn">${esc(d.name)}${d.tag==='agreement'?`<span class="doctag">Management Agreement · ${fmt(d.date)}</span>`:''}</span><span class="meta">Uploaded ${fmt(d.date)}</span>
          <button class="btn sm" data-act="docView" data-id="${u.id}" data-i="${i}">View</button>
          <button class="btn sm" data-act="docDown" data-id="${u.id}" data-i="${i}">Download</button>
          ${ro?'':`<button class="iconbtn" data-act="docDel" data-id="${u.id}" data-i="${i}" aria-label="Remove ${esc(d.name)}">${ic('x','sm')}</button>`}</li>`).join('')}</ul>` : ''}
      ${ro?'':`<label class="drop">${ic('plus','sm')}Upload PDF<input type="file" accept=".pdf,application/pdf" multiple data-k="docUp" data-id="${u.id}" class="sr"></label>`}
    </div>`;
  const tasks = list.map((t,i)=>{
    const ownerTask = t.who==='owner' && !t.done && !t.na;
    const dueTxt = t.na ? '' : !t.due ? ((t.done || ro || t.special!=='clientlines') ? '' : '<span class="tdue wait">Waiting on client</span>')
      : `<span class="tdue ${!t.done&&diff(t.due)<0?'late':''}">${!t.done&&diff(t.due)===0?'Today':fmt(t.due)}</span>`;
    const naBtn = (t.who==='owner' || ro) ? (t.na ? `<span class="nalbl">${t.auto_na?'N/A · tier':'N/A'}</span>` : '')
      : `<button class="nabtn ${t.na?'on':''}" data-act="taskNA" data-id="${u.id}" data-i="${i}" aria-pressed="${!!t.na}" title="${t.na?'Restore task':'Mark not applicable'}">N/A</button>`;
    return `
    <li class="${t.done?'done':''} ${t.na?'na':''} ${ownerTask?'owner':''} ${ro?'ro':''}">
      ${t.na
        ? `<div class="ownrow"><span class="nadash" aria-hidden="true">—</span><span class="tn">${esc(t.name)}</span>${t.link?appLink():''}${t.special==='sent'&&!t.done&&!ro?`<span class="tsend">Send to: ${u.handoff.whatsapp?`<b>+1 ${esc(u.handoff.whatsapp)}</b>`:'no WhatsApp number — add in Handoff'}</span>`:''}${t.done&&t.doneAt?`<span class="tdone">${esc(whoName(t.doneBy))} · ${relTime(t.doneAt)}</span>`:''}</div>`
        : ownerTask
        ? `<div class="ownrow"><i class="dot" style="background:var(--grey)"></i><span class="tn">${esc(t.name)}</span>${t.link?appLink():''}${t.done&&t.doneAt?`<span class="tdone">${esc(whoName(t.doneBy))} · ${relTime(t.doneAt)}</span>`:''}<span class="owntag">Waiting on owner</span></div>`
        : (ro || AUTO.includes(t.special))
          ? `<label ${ro?'title="Read-only"':'title="Updates from the line items below"'}><input type="checkbox" disabled ${t.done?'checked':''}><span class="tn">${esc(t.name)}</span>${t.link?appLink():''}${t.done&&t.doneAt?`<span class="tdone">${esc(whoName(t.doneBy))} · ${relTime(t.doneAt)}</span>`:''}${!ro?'<span class="owntag">Auto</span>':''}</label>`
          : `<label><input type="checkbox" data-act="task" data-id="${u.id}" data-i="${i}" ${t.id?`data-task-id="${t.id}"`:''} ${t.done?'checked':''}><span class="tn">${esc(t.name)}</span>${t.link?appLink():''}${t.done&&t.doneAt?`<span class="tdone">${esc(whoName(t.doneBy))} · ${relTime(t.doneAt)}</span>`:''}</label>`}
      ${avatar(t.who,u,'sm')}
      ${dueTxt}
      ${naBtn}
      ${t.custom && view!=='past' ? `<button class="iconbtn tdel" data-act="taskDel" data-id="${u.id}" data-cid="${t.cid}" data-s="${selId}" aria-label="Remove ${esc(t.name)}" title="Remove task">${ic('x','sm')}</button>` : ''}
    </li>`;}).join('');
  // Monday-style "+ Add task" row at the end of the group (current + upcoming stages)
  const canAdd = view!=='past' && u.status.k!=='done';
  const addRow = !canAdd ? '' : ui.addTask[u.id]===selId ? `
    <li class="addtask open">
      <input class="input atname" data-k="atName" data-id="${u.id}" placeholder="Task name" aria-label="New task name" autocomplete="off">
      <select class="input atwho" data-k="atWho" aria-label="Assign to">${assignable().map(([k,m])=>`<option value="${k}" ${k===(selId==='software'?'shane':u.assignee)?'selected':''}>${m.name}</option>`).join('')}<option value="owner">Property owner</option></select>
      <div class="datefield atdue"><input class="input" data-k="atDue" data-date placeholder="Due (optional)" autocomplete="off" aria-label="Due date"><button type="button" class="dfbtn" data-dp tabindex="-1" aria-label="Open calendar"><svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg></button></div>
      <span class="atbtns"><button class="btn sm primary" data-act="addTaskSave" data-id="${u.id}" data-s="${selId}">Add</button><button class="btn sm ghost" data-act="addTaskCancel" data-id="${u.id}">Cancel</button></span>
      ${view==='future'?`<span class="meta athint">Added to ${sel.name} — it appears when this stage starts.</span>`:''}
      ${teamNoteHTML()}
    </li>`
    : `<li class="addtask"><button class="addbtn" data-act="addTaskOpen" data-id="${u.id}" data-s="${selId}">${ic('plus','sm')}Add task</button></li>`;
  const cleaner = !ro && u.tasks.some(t=>t.special==='cleaner') ? `
    <div class="inline-field"><label for="cl${u.id}">Cleaner</label><input class="input" style="flex:1" id="cl${u.id}" data-k="cleaner" data-id="${u.id}" value="${esc(u.cleaner)}" placeholder="Type the cleaner’s name"></div>` : '';
  const snotes = u.notes.filter(n=>n.stage===selId);
  const leftTasks = isNA
    ? `<div class="skipbox"><b>Skipped — not applicable</b><span class="meta">This stage was marked as not needed for this unit.</span><button class="btn sm ghost" data-act="unskip" data-id="${u.id}" data-s="${selId}">Undo skip</button></div>`
    : selId==='audit'
      ? `${auditTasksHTML(u, list, ro, view)}${addRow?`<ul class="tasks">${addRow}</ul>`:''}`
      : `<ul class="tasks">${tasks}${addRow}</ul>${cleaner}`;
  return `<div class="dwrap" data-detail="${u.id}">
    ${head}
    <div class="dbody">
      ${phasesHTML(u)}
      ${factsRow(u)}
      ${whatsappWelcomeHTML(u)}
      ${stageTabs(u, selId)}
      <div class="dgrid">
        <div>${leftTasks}${skipUI(u, selId, isNA)}${advance}</div>
        <div class="facts"><dl>
          <dt>Owner</dt><dd>${esc(u.owner)}</dd>
          ${u.phone?`<dt>Phone</dt><dd>${esc(u.phone)}</dd>`:''}
          <dt>Plan</dt><dd>${u.plan}${furnText(u)?`<br><span class="meta">${furnText(u)}</span>`:''}${tierOf(u)?`<br><span class="meta">${esc(tierLine(u))}</span>`:''}</dd>
          <dt>Onboarding</dt><dd>Day ${u.day} · <span class="meta">target 7</span></dd>
          <dt>Stage due</dt><dd>${dueHTML(u.due)}</dd>
          <dt>Cleaner</dt><dd>${u.cleaner?esc(u.cleaner):'<span class="meta">Not set</span>'}</dd>
        </dl>
        <h6>Handoff</h6>
        <dl>
          <dt>Access</dt><dd>${hv(u.handoff.access)}</dd>
          <dt>Alarm</dt><dd>${u.handoff.alarm==='Has alarm' && u.handoff.alarmInfo ? masked(u,'alarmInfo',u.handoff.alarmInfo) : hv(alarmText(u.handoff))}</dd>
          <dt>Parking</dt><dd>${hv(u.handoff.parking)}</dd>
          <dt>Wifi</dt><dd>${u.handoff.wifi?`${esc(u.handoff.wifi)}${u.handoff.wifiPw?`<br>${masked(u,'wifiPw',u.handoff.wifiPw)}`:''}`:hv()}</dd>
          <dt class="wide">Known issues</dt><dd class="wide">${hv(u.handoff.issues)}</dd>
        </dl></div>
      </div>
      ${isNA ? '' : linesHTML(u, selId, ro)}
      ${docs}
      ${ro?'':`<div class="inline-field"><input class="input note" data-k="note" data-id="${u.id}" placeholder="Add a note and press Enter…" aria-label="Add a note"></div>`}
      ${snotes.length?`<ul class="notes">${snotes.slice(-4).map(n=>`<li>${avatar(n.by,u,'sm')}<span><span class="meta">${n.ts?relTime(n.ts)+' · ':''}${esc(whoName(n.by))}:</span> ${esc(n.t)}</span></li>`).join('')}</ul>`:(ro?'<div class="meta">No notes for this stage.</div>':'')}
      ${historyHTML(u)}
    </div>
  </div>`;
}

function flagBtn(u){
  return `<button class="iconbtn flagbtn ${u.flags?'on':''}" data-act="flag" data-id="${u.id}" aria-pressed="${!!u.flags}" aria-label="${u.flags?'Clear flag':'Flag for attention'}" title="${u.flags?'Clear flag':'Flag for attention'}">${ic('flag','sm')}${u.flags?u.flags:''}</button>`;
}
function archiveBtn(u){
  if(ui.archiveAsk===u.id) return `<span class="skipask" role="alertdialog" aria-label="Confirm archive" style="display:inline-flex;align-items:center;gap:6px;margin:0">
      <span class="meta">Archive <b>${esc(u.addr)}</b>?</span>
      <button class="btn sm danger" data-act="archiveYes" data-id="${u.id}">Archive</button>
      <button class="btn sm ghost" data-act="archiveNo" data-id="${u.id}">Cancel</button>
    </span>`;
  return `<button class="iconbtn" data-act="archiveAsk" data-id="${u.id}" aria-label="Archive ${esc(u.addr)}" title="Archive unit">${ic('x','sm')}</button>`;
}
function filteredUnits(){
  const f=ui.f;
  const q=(f.q||'').trim().toLowerCase();
  return units.filter(u=>
    (!f.stage || STAGES[u.stage].id===f.stage) &&
    (!f.who   || u.assignee===f.who) &&
    (!f.plan  || u.plan===f.plan) &&
    (!f.attn  || u.flags>0 || u.status.k==='blocked' || u.status.k==='ready') &&
    (!q || String(u.addr||'').toLowerCase().includes(q) || String(u.owner||'').toLowerCase().includes(q)));
}
function renderFilters(){
  const f=ui.f, any=f.stage||f.who||f.plan||f.attn||(f.q||'').trim();
  const sel=(k,label,opts)=>`<label class="fsel ${f[k]?'on':''}"><span class="sr">${label}</span><select class="input" data-filter="${k}">${opts.map(([v,t])=>`<option value="${v}" ${f[k]===v?'selected':''}>${t}</option>`).join('')}</select></label>`;
  $('#filters').innerHTML =
    `<label class="fsel ${f.q?'on':''}" style="flex:1;min-width:160px;max-width:280px"><span class="sr">Search</span><input class="input" data-filter="q" type="search" placeholder="Search address or owner" value="${esc(f.q||'')}" autocomplete="off"></label>` +
    sel('stage','Stage',[['','All stages'],...STAGES.map(s=>[s.id,s.name])]) +
    sel('who','Assignee',[['','All team'],...Object.entries(TEAM).filter(([k])=>k!=='admin').map(([k,m])=>[k,m.name])]) +
    sel('plan','Plan',[['','All plans'],['Standard','Standard'],['Full Service','Full Service'],['Growth','Growth'],['Essentials','Essentials']]) +
    `<label class="ftog ${f.attn?'on':''}"><span class="switch"><input type="checkbox" data-filter="attn" ${f.attn?'checked':''}><i></i></span>Needs attention only</label>` +
    (any?`<button class="linkbtn fclear" data-act="clearFilters">Clear filters</button><span class="meta">${filteredUnits().length} of ${units.length} units</span>`:'');
}
function renderPipeline(){
  renderFilters();
  const shown = filteredUnits();
  units.forEach(u=>{ const sid=STAGES[u.stage].id; u.notes.forEach(n=>{ if(!n.stage) n.stage=sid; }); u.docs.forEach(d=>{ if(!d.stage) d.stage=sid; }); });
  $('#tbody').innerHTML = (shown.length?'':`<tr><td colspan="7" class="fempty">No units match these filters. <button class="linkbtn" data-act="clearFilters">Clear filters</button></td></tr>`) + shown.map(u=>{
    const open = ui.open.has(u.id), m = TEAM[u.assignee];
    return `<tr class="row ${open?'open':''}" data-row="${u.id}" tabindex="0" aria-expanded="${open}">
      <td class="prop"><b class="addrline">${esc(u.addr)}${u.isNew?`<span class="chip newpill" style="background:oklch(0.6 0.15 255 / .14);color:oklch(0.45 0.13 255)">New</span>`:''}</b><span class="meta">${esc(formatType(u.type))} · ${esc(u.owner)}</span></td>
      <td>${planChip(u)}</td>
      <td><div class="who">${avatar(u.assignee)}<div><b>${esc((m&&m.name)||u.assignee||'Unassigned')}</b><br><span class="meta">${esc((m&&m.role)||'')}</span></div></div></td>
      <td>${stageChip(u.stage)}${stepOf(u)}</td>
      <td>${statusHTML(u)}</td>
      <td>${dueHTML(u.due, u.status.k==='done')}<br><span class="meta">Day ${u.day}</span></td>
      <td><div class="acts">${flagBtn(u)}${archiveBtn(u)}
        <button class="iconbtn" data-act="expand" data-id="${u.id}" aria-label="${open?'Collapse':'Expand'} ${esc(u.addr)}">${ic('chev','sm chev')}</button></div></td>
    </tr>${open?`<tr class="detail"><td colspan="7">${detailHTML(u)}</td></tr>`:''}`;
  }).join('');

  $('#mcards').innerHTML = (shown.length?'':`<div class="card fempty">No units match these filters. <button class="linkbtn" data-act="clearFilters">Clear filters</button></div>`) + shown.map(u=>{
    const open = ui.open.has(u.id), d=STATUS[u.status.k]||STATUS.progress;
    const sl = u.status.k==='waiting' ? `Waiting on ${u.status.on}` : u.status.k==='ready' ? 'Ready to advance' : d.label(u.status);
    return `<article class="card mcard ${open?'open':''}" data-card="${u.id}">
      <div class="top" style="padding:14px 16px 0">
        <button class="mtap" data-row="${u.id}" aria-expanded="${open}" style="padding:0;flex:1">
          <span class="prop"><b class="addrline">${esc(u.addr)}${u.isNew?`<span class="chip newpill" style="background:oklch(0.6 0.15 255 / .14);color:oklch(0.45 0.13 255)">New</span>`:''}</b><span class="meta">${esc(formatType(u.type))} · ${esc(u.owner)}</span></span>
        </button>
        <div style="display:flex;align-items:center;gap:2px;margin:-6px -8px 0 0">${flagBtn(u)}${archiveBtn(u)}<button class="iconbtn" data-act="expand" data-id="${u.id}" aria-label="${open?'Collapse':'Expand'}">${ic('chev','sm chev')}</button></div>
      </div>
      <button class="mtap" data-row="${u.id}" tabindex="-1" aria-hidden="true" style="padding-top:0">
        <span class="chips">${planChip(u)} ${stageChip(u.stage)}${stepOf(u)}</span>
        <span class="row3">
          <span style="display:flex;align-items:center;gap:6px">${avatar(u.assignee,u,'sm')}${esc((TEAM[u.assignee]&&TEAM[u.assignee].name)||u.assignee||'Unassigned')}</span>
          <span style="display:flex;align-items:center;gap:6px"><i class="dot" style="background:${d.dot};${d.ring?'box-shadow:inset 0 0 0 1.5px var(--grey)':''}"></i>${esc(sl)}</span>
          <span>Day ${u.day}</span>
        </span>
        ${u.status.k==='blocked'?`<span style="display:block;font-size:var(--t-sm);font-weight:500;color:var(--redink);margin-top:6px">${esc(u.status.reason)}</span>`:''}
      </button>
      ${open?detailHTML(u):''}
    </article>`;
  }).join('').replace(/name="(ho\w+)"/g,'name="m-$1"');
  const oldModal=root.querySelector('.audit-modal-scrim'); if(oldModal) oldModal.remove();
  if(ui.stravoModal) root.insertAdjacentHTML('beforeend', stravoModalHTML());
}
function toggleRow(id){ ui.open.has(id)?ui.open.delete(id):ui.open.add(id); renderPipeline(); }

/* Key moment: approve / mark live — pushed feedback, blur-swap icon, then the state change */
function landFeedback(btn, label){
  if(!btn) return;
  btn.disabled=true; btn.classList.remove('primary'); btn.classList.add('ok','pushed');
  const l=btn.querySelector('.lbl'); if(l) l.textContent=label;
  const sw=btn.querySelector('.swap'); if(sw) sw.classList.add('on');
}
function flashUnit(id){
  requestAnimationFrame(()=>root.querySelectorAll(`[data-row="${id}"].row, [data-card="${id}"]`).forEach(el=>{ el.classList.remove('landed'); void el.offsetWidth; el.classList.add('landed'); }));
}
function approve(id, btn, fromUp){
  const u=unitById(id); if(!u || ui.busy.has(id)) return;
  ui.busy.add(id);
  const isLive = STAGES[u.stage].id==='live';
  landFeedback(btn, isLive?'Live':'Approved');
  setTimeout(()=>{
    ui.busy.delete(id);
    ui.open.add(id);
    act('advance', { unit_id: u.id }).then(()=>{ flashUnit(id); toast(isLive?`${short(u.addr)} is live`:`${STAGES[u.stage].name} approved`); });
  }, 400);
}

root.addEventListener('click', e=>{
  if(e.target.closest('[data-cmdk]')){ openCmdk(); return; }
  if(e.target.closest('[data-cta]')){ openStart(); return; }
  const pth=e.target.closest('[data-path]'); if(pth){ if(pth.closest('#unitForm')) closeModal(true); hideScrim('startScrim'); hideScrim('pickScrim'); pth.dataset.path==='crm' ? openPicker() : openModal('manual'); return; }
  const cl=e.target.closest('[data-close]'); if(cl){ hideScrim(cl.dataset.close); return; }
  const n=e.target.closest('[data-nav]'); if(n){ setNav(n.dataset.nav); return; }
  const a=e.target.closest('[data-act]');
  if(a){
    const id=a.dataset.id, u=unitById(id);
    switch(a.dataset.act){
      case 'openUnit': { ['startScrim','pickScrim'].forEach(hideScrim); goToUnit(a.dataset.u); return; }
      case 'openLeadFromUnit': { if(host.openLead) host.openLead(a.dataset.l); return; }
      case 'waWelcomeCopy': {
        const msg = waWelcomeMessage(u).text;
        const btn = a;
        const done = () => {
          btn.textContent = 'Copied! ✓';
          setTimeout(() => { if (btn.isConnected) btn.textContent = 'Copy message'; }, 2000);
        };
        navigator.clipboard.writeText(msg).then(done).catch(() => {
          host.onError?.(new Error('Could not copy — check clipboard permissions.'));
        });
        return;
      }
      case 'pickLead': { hideScrim('pickScrim'); const l=leadById(a.dataset.l); if(l) openModal('crm', l); return; }
      case 'expand': toggleRow(id); return;
      case 'flag':
        act('flag', { unit_id: u.id }); toast(u.flags?`Clearing flag…`:`Flagging…`); return;
      case 'archiveAsk': ui.archiveAsk=id; renderPipeline(); return;
      case 'archiveNo': ui.archiveAsk=null; renderPipeline(); return;
      case 'archiveYes':
        ui.archiveAsk=null;
        act('archive_unit', { unit_id: u.id, by: 'Admin' }).then(()=>{ ui.open.delete(id); toast(`Archived ${u.addr}`); });
        return;
      case 'approve': approve(id, a); return;
      case 'changes':
        act('request_changes', { unit_id: u.id }); toast('Requesting changes…'); return;
      case 'startStage': {
        const box=a.closest('.dwrap');
        const who=box.querySelector('[data-k=nextWho]').value, d=parseDate(box.querySelector('[data-k=nextDue]').value) || addDays(TODAY,3);
        landFeedback(a,'Assigned');
        const whoName=(TEAM[who]&&TEAM[who].name)||who;
        setTimeout(()=>{
          act('advance', {
            unit_id: u.id,
            next_assignee: whoName,
            next_due: iso(d),
            advanced_by: 'Admin',
          }).then(()=>{ flashUnit(id); toast(`${STAGES[u.stage].name} assigned to ${whoName}, due ${fmt(iso(d))}`); });
        }, 400);
        return;
      }
      case 'advance': {
        const nextId=nextStageId(u);
        const box=a.closest('.dwrap')||a.closest('.advance')||a.parentElement;
        const whoEl=box && box.querySelector('[data-k=nextWho]');
        const dueEl=box && box.querySelector('[data-k=nextDue]');
        const who=whoEl?whoEl.value:u.assignee;
        const d=dueEl ? (parseDate(dueEl.value) || null) : null;
        const whoName=(TEAM[who]&&TEAM[who].name)||who;
        landFeedback(a, nextId ? 'Started' : 'Live');
        setTimeout(()=>{
          delete ui.tab[id];
          act('advance', {
            unit_id: u.id,
            next_assignee: nextId ? whoName : undefined,
            next_due: nextId && d ? iso(d) : undefined,
            advanced_by: 'Admin',
          }).then(()=>{ flashUnit(id); toast(nextId ? `Advanced to ${STAGES[SIDX[nextId]].name} · ${whoName}${d?` · due ${fmt(iso(d))}`:''}` : `${short(u.addr)} is live`); });
        }, 400);
        return;
      }
      case 'tab': {
        const next=a.dataset.s;
        if(next==='intake'){ ui.tab[id]='audit'; }
        else ui.tab[id]=next;
        delete ui.skipAsk[id];
        if(ui.tab[id]!=='audit'){ delete ui.auditExp[id]; stopAuditPoll(); }
        renderPipeline();
        root.querySelector(`[data-detail="${id}"] .stab.sel`)?.scrollIntoView({block:'nearest',inline:'nearest'}); return;
      }
      case 'auditToggle': {
        ui.auditExp[id]=!ui.auditExp[id];
        if(ui.auditExp[id]){
          loadAuditIntake(id, true);
          loadAuditIntake(id, false);
          ensureAuditPoll();
        } else { stopAuditPoll(); renderPipeline(); }
        return;
      }
      case 'auditSendPortal': {
        const name=whoName(u.assignee);
        act('send_portal_link', { unit_id: u.id, unitId: u.id, onboarderName: name, display_name: name }).then((res)=>{
          u.portalLinkSentAt = (res && res.portal_link_sent_at) || new Date().toISOString();
          toast(res && res.email_sent===false ? (res.email_error || 'Invite created; email failed') : 'Portal link sent');
          renderPipeline();
        });
        return;
      }
      case 'auditViewAll': {
        // Opens the full Intake progress page (Intake_Progress.html) over Onboarding.
        const vu=units.find(x=>String(x.id)===String(id));
        if(vu && host.openIntake){
          host.openIntake(unitTarget(vu, 'audit'));
          return;
        }
        ui.auditExp[id]=true;
        loadAuditIntake(id);
        toast('Showing latest intake activity');
        return;
      }
      case 'stravoOpen': {
        ui.stravoModal={ unitId:id, q:'', results:[], loading:false };
        renderPipeline();
        root.querySelector('[data-k=stravoQ]')?.focus();
        return;
      }
      case 'stravoClose':
        if(a.classList.contains('audit-modal-scrim') && e.target!==a) return;
        ui.stravoModal=null; renderPipeline(); return;
      case 'stravoLink': {
        const pid=a.dataset.pid;
        act('link_stravo_property', { unit_id: id, unitId: id, cleanerPropertyId: pid }).then(()=>{
          u.cleanerPropertyId=pid;
          ui.stravoModal=null;
          toast('Linked to Stravo');
          if(ui.auditExp[id]) loadAuditIntake(id);
          else renderPipeline();
        });
        return;
      }
      case 'addTaskOpen': ui.addTask[id]=a.dataset.s; renderPipeline();
        root.querySelector(`[data-detail="${id}"] [data-k=atName]`)?.focus(); return;
      case 'addTaskCancel': delete ui.addTask[id]; renderPipeline(); return;
      case 'addTaskSave': saveNewTask(id, a.dataset.s); return;
      case 'taskDel': {
        const cid=+a.dataset.cid, sid=a.dataset.s;
        u.tasks=u.tasks.filter(t=>t.cid!==cid);
        if(u.extra&&u.extra[sid]) u.extra[sid]=u.extra[sid].filter(t=>t.cid!==cid);
        events=events.filter(ev=>ev.cid!==cid);
        refreshStatus(u); renderAll(); toast('Task removed'); return;
      }
      case 'deliverTo': u.deliverTo=a.dataset.v; act('update_unit', { unit_id: u.id, deliver_to: a.dataset.v }); toast(`Deliveries go to ${a.textContent}`); return;
      case 'clearFilters': ui.f={stage:'',who:'',plan:'',attn:false,q:''}; renderPipeline(); return;
      case 'openUnitTab': {
        // Client review / Go-live check pages, over Onboarding (same overlay as Intake progress).
        const vu=units.find(x=>String(x.id)===String(id));
        if(vu && host.openIntake) host.openIntake(unitTarget(vu, a.dataset.tab==='golive'?'golive':'review'));
        return;
      }
      case 'toDocs': root.querySelector(`.tablebox #docs-${id}, [data-card="${id}"] #docs-${id}`)?.scrollIntoView({behavior:'smooth',block:'center'}); return;
      case 'histAll': ui.histAll.has(id)?ui.histAll.delete(id):ui.histAll.add(id); renderPipeline(); return;
      case 'taskNA': {
        const t=u.tasks[+a.dataset.i];
        if(t && t.id) act('na_task', { id: t.id, na: !t.na });
        else { t.na=!t.na; if(t.na) t.done=false; refreshStatus(u,true); renderAll(); }
        return;
      }
      case 'skipStage': ui.skipAsk[id]=a.dataset.s; renderPipeline(); root.querySelector(`[data-act=skipYes][data-id="${id}"]`)?.focus(); return;
      case 'skipNo': delete ui.skipAsk[id]; renderPipeline(); return;
      case 'skipYes': {
        const sid=a.dataset.s, st=STAGES[SIDX[sid]];
        delete ui.skipAsk[id];
        act('skip_stage', { unit_id: u.id, stage: STAGE_TO_NAME[sid] || st.name }).then(()=>{ ui.tab[id]=sid; flashUnit(id); toast(`${st.name} skipped`); });
        return;
      }
      case 'unskip': {
        const sid=a.dataset.s, st=STAGES[SIDX[sid]];
        act('unskip_stage', { unit_id: u.id, stage: STAGE_TO_NAME[sid] || st.name }).then(()=>{
          ui.tab[id]=sid; flashUnit(id); toast(`${st.name} restored`);
        });
        return;
      }
      case 'hoEdit': {
        ui.hoEdit.add(id); renderPipeline();
        root.querySelector(`[data-detail="${id}"] [data-ho]`)?.focus(); return;
      }
      case 'reveal': { const k=a.dataset.k; revealed.has(k)?revealed.delete(k):revealed.add(k);
        const inp=a.closest('.pwfield')?.querySelector('input');
        if(inp){ inp.type = revealed.has(k)?'text':'password'; a.innerHTML = revealed.has(k)?'<svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.7 8.5 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 4.4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>':'<svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'; return; }
        renderPipeline(); return; }
      case 'hoEditX': ui.hoEdit.add(id); renderPipeline(); root.querySelector(`[data-detail="${id}"] [data-ho]`)?.focus(); return;
      case 'hoCancel': ui.hoEdit.delete(id); renderPipeline(); return;
      case 'hoSave': {
        const box=a.closest('.dwrap'), h=u.handoff;
        box.querySelectorAll('[data-ho]').forEach(f=>{
          if(f.closest('.furn')) return;
          if(f.type==='radio'){ if(f.checked) h[f.dataset.ho]=f.value; return; }
          const k=f.dataset.ho;
          let v=f.value.trim().replace(/[ \t]+/g,' ');
          if((k==='cPhone'||k==='whatsapp') && v) v=cleanPhone(v).v;
          if(k==='cName' && v) v=cleanName(v);
          if(k==='feeAmount' && v) v=String(parseFloat(v.replace(/[^0-9.]/g,''))||'');
          if(k==='fobCount' && v) v=String(parseInt(v.replace(/\D/g,''))||'');
          if(/Url$/.test(k) && v && !/^https?:\/\//i.test(v)) v='https://'+v;
          if(k==='ownerName'){ if(v) u.owner=cleanName(v); return; }
          h[k]=v;
        });
        if(h.alarm!=='Has alarm') h.alarmInfo = h.alarm==='None' ? '' : h.alarmInfo;
        if(h.fee!=='Charged') h.feeAmount=''; if(h.fee!=='Waived') h.feeReason='';
        h.strLicence=(h.strLicence||'').toUpperCase();
        const fb=box.querySelector('[data-furnbox]');
        if(fb){ const fv=syncFurnBox(fb,u.plan,h.strLicence); if(fv!==u.furniture){ u.furniture=fv; logH(u,`Furniture program set to ${furnText(u)||'None'}`); }
          u.furnitureBudget = fv==='client' ? (parseFloat(fb.querySelector('[data-k=furnBudget]').value.replace(/[^0-9.]/g,''))||0) : undefined; }
        landFeedback(a,'Saved');
        const patch = {
          access_method: h.access||null,
          access_location: h.accessLoc||null,
          access_code: h.entry||null,
          building_entry_method: h.bldMethod||null,
          building_code: h.bldCode||null,
          fob_count: h.fobCount?parseInt(h.fobCount,10)||0:0,
          parking_spot: h.parking||null,
          parking_method: h.parkMethod||null,
          parking_code: h.parkCode||null,
          wifi_name: h.wifi||null,
          wifi_password: h.wifiPw||null,
          alarm_type: h.alarm==='None'?'none':(h.alarm||'none'),
          alarm_instructions: h.alarmInfo||null,
          concierge_name: h.cName||null,
          concierge_phone: h.cPhone||null,
          concierge_hours: h.cHours||null,
          known_issues: h.issues||null,
        };
        const unitPatch = {
          owner_whatsapp: h.whatsapp||null,
          owner_phone: h.phone||null,
          str_licence: h.strLicence||null,
          str_permit_status: h.permit||null,
          onboarding_fee_status: (h.fee||'').toLowerCase()||null,
          onboarding_fee_amount: h.feeAmount?parseFloat(h.feeAmount)||null:null,
          existing_airbnb_url: h.existingUrl||null,
          hospitable_property_id: h.hospId||null,
          airbnb_url: h.airbnbUrl||null,
          furniture: u.furniture||null,
          furniture_budget: u.furnitureBudget||null,
          deliver_to: u.deliverTo||null,
          building_name: h.buildingName||null,
          unit_floor: h.unitFloor||null,
          building_manager: h.bmContact||null,
          elevator_booking_required: h.elevator==='Yes',
          moving_hours: h.movingHours||null,
          coi_required: h.coi==='Yes',
          building_notes: h.buildingNotes||null,
        };
        Promise.resolve(act('update_handoff', { unit_id: u.id, patch }))
          .then(()=>act('update_unit', { unit_id: u.id, ...unitPatch }))
          .finally(()=>{ ui.hoEdit.delete(id); toast('Handoff saved'); });
        return;
      }
      case 'changesOpen':
        ui.changes.has(id) ? ui.changes.delete(id) : ui.changes.add(id); renderPipeline();
        if(ui.changes.has(id)) root.querySelector(`[data-k=changeNote][data-id="${id}"]`)?.focus();
        return;
      case 'changesSend': sendChanges(id); return;
      case 'docView': openPdf(u, u.docs[+a.dataset.i]); return;
      case 'docDown': {
        const d=u.docs[+a.dataset.i]; downloadDoc(u,d); return;
      }
      case 'docDel': {
        const d=u.docs[+a.dataset.i];
        if(d && d.id) act('remove_doc', { doc_id: d.id });
        else { u.docs.splice(+a.dataset.i,1); renderPipeline(); }
        toast(d?`Removed ${d.name}`:'Removed'); return;
      }
      case 'lineRyan': {
        const l=u.lines.find(x=>String(x.id)===String(a.dataset.l)); if(!l) return;
        l.ryan=!l.ryan;
        if(!l.ryan){ l.client='pending'; u.budgetOk=false; }
        act('update_line', { id: l.id, ryan: l.ryan, client: l.client });
        return;
      }
      case 'lineClient': {
        const l=u.lines.find(x=>String(x.id)===String(a.dataset.l)); if(!l) return;
        l.client=a.dataset.v;
        act('update_line', { id: l.id, client: l.client });
        if(l.client!=='pending') toast(`${l.item}: client ${l.client}`);
        return;
      }
      case 'budget': u.budgetOk=!u.budgetOk; refreshStatus(u,true); renderAll(); return;
      case 'lineDel': {
        const lid=a.dataset.l;
        act('remove_line', { id: lid });
        return;
      }
      case 'lineAdd': {
        const box=a.closest('.lineadd'), g=k=>box.querySelector(`[data-k=${k}]`).value.trim();
        const item=g('lItem'); if(!item){ box.querySelector('[data-k=lItem]').focus(); return; }
        const qty=Math.max(1,parseInt(g('lQty').replace(/\D/g,''))||1), price=parseFloat(g('lPrice').replace(/[^0-9.]/g,''))||0;
        const sid=STAGES[u.stage].id;
        act('add_line', {
          unit_id: u.id,
          item: item.charAt(0).toUpperCase()+item.slice(1),
          room: g('lRoom'),
          qty, price,
          ryan: sid==='procurement',
          client: sid==='procurement'?'approved':'pending',
          deliver: 'unit',
        });
        return;
      }
      case 'up': upAction(a.dataset.key, a); return;
    }
  }
  const r=e.target.closest('[data-row]');
  if(r && !e.target.closest('.dwrap') && !e.target.closest('button:not([data-row]),input,select,a')) toggleRow(r.dataset.row);
});
let taskCid=1000;
function saveNewTask(id, sid){
  const u=unitById(id), box=root.querySelector(`[data-detail="${id}"] .addtask.open`); if(!box) return;
  const nameEl=box.querySelector('[data-k=atName]');
  const raw=nameEl.value.trim().replace(/\s+/g,' ');
  if(!raw){ nameEl.focus(); return; }
  const name=raw.charAt(0).toUpperCase()+raw.slice(1);
  const who=box.querySelector('[data-k=atWho]').value;
  const dRaw=box.querySelector('[data-k=atDue]').value.trim(), d=dRaw?parseDate(dRaw):null;
  if(dRaw && !d){ box.querySelector('[data-k=atDue]').focus(); toast('Couldn’t read that date — try “fri” or “nov 20”'); return; }
  const st=STAGES[SIDX[sid]];
  const whoName=who==='owner'?'owner':((TEAM[who]&&TEAM[who].name)||who);
  const stageName=STAGE_TO_NAME[sid]||st.name;
  const due=d?iso(d):null;
  nameEl.value='';
  act('add_task', { unit_id: u.id, stage: stageName, label: name, assignee: whoName, due_on: due || undefined })
    .then(()=>{
      if(due && SCHED_TEAM.includes(who)){
        return act('add_schedule', { unit_id: u.id, who: whoName, stage: stageName, task: name, start: due, span: 1, status: 'Scheduled' });
      }
    })
    .then(()=> toast(`Added to ${st.name}${who==='owner'?' · waiting on owner':` · ${whoName}`}${due?` · due ${fmt(due)}`:''}`));
  root.querySelector(`[data-detail="${id}"] [data-k=atName]`)?.focus();
}
function sendChanges(id){
  const u=unitById(id), f=root.querySelector(`[data-k=changeNote][data-id="${id}"]`), msg=f?f.value.trim():'';
  ui.changes.delete(id);
  act('request_changes', { unit_id: u.id, note: msg || 'Changes requested' }).then(()=> toast('Changes requested — back to In Progress'));
}
root.addEventListener('keydown', e=>{
  if(e.target.closest && e.target.closest('.addtask.open') && $('#dp').hidden){
    const box=e.target.closest('[data-detail]'), id=+box.dataset.detail;
    if(e.key==='Enter' && e.target.dataset.k!=='atDue' || (e.key==='Enter' && e.target.dataset.k==='atDue')){ e.preventDefault(); saveNewTask(id, ui.addTask[id]); return; }
    if(e.key==='Escape'){ e.preventDefault(); delete ui.addTask[id]; renderPipeline(); return; }
  }
  if(e.key==='Enter' && e.target.dataset && e.target.dataset.k==='changeNote'){ e.preventDefault(); sendChanges(e.target.dataset.id); return; }
  if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); cmdkOpen()?closeCmdk():openCmdk(); return; }
  if(e.key==='Escape'){ const top=['pickScrim','startScrim'].find(x=>$('#'+x).classList.contains('show')); if(top && $('#dp').hidden){ hideScrim(top); return; } if(!$('#dp').hidden){ closeDP(true); } else if($('#pdfScrim').classList.contains('show')) closePdf(); else if($('#draftScrim').classList.contains('show')) closeDraft(); else if(cmdkOpen()) closeCmdk(); else if(!$('#pop').hidden) closePop(); else closeModal(); return; }
  const r=e.target.closest && e.target.closest('tr[data-row]');
  if(r && (e.key==='Enter'||e.key===' ') && e.target===r){ e.preventDefault(); toggleRow(r.dataset.row); }
  if(e.key==='Enter' && e.target.dataset && e.target.dataset.k==='note' && e.target.value.trim()){
    const u=unitById(e.target.dataset.id); const text=e.target.value.trim(); if(!text) return; act('add_note', { unit_id: u.id, text, stage: STAGE_TO_NAME[STAGES[u.stage].id]||STAGES[u.stage].name }); e.target.value='';
    const n=root.querySelector(`[data-k=note][data-id="${u.id}"]`); if(n) n.focus();
  }
});
let stravoSearchTimer=null;
root.addEventListener('input', e=>{
  const t=e.target;
  if(t.dataset && t.dataset.filter==='q'){ ui.f.q = t.value; renderPipeline(); return; }
  if(t.dataset && t.dataset.k==='stravoQ' && ui.stravoModal){
    ui.stravoModal.q=t.value;
    clearTimeout(stravoSearchTimer);
    const q=t.value.trim();
    if(q.length<2){ ui.stravoModal.results=[]; ui.stravoModal.loading=false; renderAll(); return; }
    ui.stravoModal.loading=true;
    renderAll();
    const get = host.get || ((params)=>fetch('/api/admin/pm?'+new URLSearchParams({resource:'onboarding',...params}),{credentials:'include'}).then(r=>r.json()));
    stravoSearchTimer=setTimeout(()=>{
      get({ op:'search_stravo_properties', q }).then(data=>{
        if(!ui.stravoModal || ui.stravoModal.q.trim()!==q) return;
        ui.stravoModal.results=(data && data.properties) || [];
        ui.stravoModal.loading=false;
        renderAll();
        const inp=root.querySelector('[data-k=stravoQ]'); if(inp){ inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      }).catch(err=>{ if(ui.stravoModal){ ui.stravoModal.loading=false; renderAll(); } if(host.onError) host.onError(err); });
    }, 250);
  }
});
root.addEventListener('change', e=>{
  const t=e.target;
  if(t.dataset && t.dataset.filter){ const k=t.dataset.filter; ui.f[k] = t.type==='checkbox' ? t.checked : t.value; renderPipeline(); return; }
  const fb=t.closest && t.closest('[data-furnbox]');
  if(fb){ const u=unitById(fb.dataset.furnbox), lic=fb.closest('.dwrap').querySelector('[data-ho=strLicence]'); syncFurnBox(fb,u.plan,lic?lic.value:''); }
  if(t.dataset.act==='task'){
    const u=unitById(t.dataset.id), tk=u.tasks[+t.dataset.i];
    if(tk && tk.id){ act('toggle_task', { id: tk.id, done: t.checked, done_by: 'Admin' }); return; }
    tk.done=t.checked;
    if(tk.done){ tk.doneAt=nowISO(); tk.doneBy='admin'; logH(u, `${tk.name} marked done · Admin`, 'task'); } else { delete tk.doneAt; delete tk.doneBy; }
    refreshStatus(u, true);
    renderAll();
  }
  if(t.dataset.k==='cleaner'){ const u=unitById(t.dataset.id); u.cleaner=cleanName(t.value); renderPipeline(); }
  if(t.dataset.k==='docUp'){
    const u=unitById(t.dataset.id), files=[...t.files];
    const pdfs=files.filter(f=>/\.pdf$/i.test(f.name)||f.type==='application/pdf');
    Promise.all(pdfs.map(f=>readFileDataUrl(f).then(url=>{
      const tag=/management|agreement|contract/i.test(f.name)?'agreement':'upload';
      return act('add_doc', { unit_id: u.id, name: f.name, url, doc_type: tag });
    }))).then(()=>{
      if(pdfs.length) toast(pdfs.length===1?`Uploaded ${pdfs[0].name}`:`Uploaded ${pdfs.length} PDFs`);
    });
    if(files.length>pdfs.length) toast('Only PDF files can be uploaded');
    t.value='';
    return;
  }
  if(t.dataset.k==='deliver'){
    const u=unitById(t.dataset.id), l=u.lines.find(x=>String(x.id)===String(t.dataset.l)); if(!l) return; l.deliver=t.value; act('update_line', { id: l.id, deliver: l.deliver });
    toast(`${l.item} → ${DELIVER(u).find(d=>d[0]===t.value)[1]}`); return;
  }
  if(t.dataset.k==='nextDue'){ const d=parseDate(t.value); if(d) t.value=fmtLong(d); }
});

/* =========================================================
   Schedule
   ========================================================= */
function weekStart(){ return addDays(TODAY, ui.week*7 - ((TODAY.getDay()+6)%7)); }
function weekEvents(ws){
  return events.map(ev=>{ const s=Math.round((parse(ev.start)-ws)/DAY); return {ev, s:Math.max(0,s), e:Math.min(6,s+ev.span-1)}; }).filter(x=>x.e>=0 && x.s<=6);
}
function renderSchedule(){
  const ws=weekStart(), days=[...Array(7)].map((_,i)=>addDays(ws,i)), we=days[6];
  $('#wLabel').textContent = `${MON[ws.getMonth()]} ${ws.getDate()} – ${ws.getMonth()!==we.getMonth()?MON[we.getMonth()]+' ':''}${we.getDate()}`;
  const DN=['Mo','Tu','We','Th','Fr','Sa','Su'];
  const todayIdx = days.findIndex(d=>iso(d)===iso(TODAY));
  const wk = weekEvents(ws);
  let h = `<div class="srow"><div class="member" style="color:var(--muted);font-weight:500">Team</div>${days.map((d,i)=>`<div class="dayh ${i===todayIdx?'today':''}">${DN[i]}<b>${d.getDate()}</b></div>`).join('')}</div>`;
  SCHED_TEAM.forEach(who=>{
    const m=TEAM[who]||{name:who, role:'', color:ok(270,.02,.5), ini:String(who).slice(0,2).toUpperCase()};
    const evs = dedupeEv(wk.filter(x=>x.ev.who===who).sort((a,b)=>a.s-b.s));
    const lanes=[]; evs.forEach(x=>{ let l=lanes.findIndex(end=>end<x.s); if(l<0){l=lanes.length;lanes.push(-1);} lanes[l]=x.e; x.lane=l; });
    const n=Math.max(1,lanes.length);
    h += `<div class="srow" data-member="${who}" style="grid-template-rows:repeat(${n},minmax(58px,auto))">
      <div class="member" style="grid-row:1 / span ${n}">${avatar(who)}<div>${esc(m.name)}<small>${esc(m.role||'')}</small></div></div>
      ${days.map((d,i)=>`<div class="bgcell ${i===todayIdx?'today':''}" style="grid-column:${i+2};grid-row:1 / span ${n}"></div>`).join('')}
      ${evs.map(x=>{ const s=STAGES[SIDX[x.ev.stage]]||STAGES[0], u=unitById(x.ev.unit);
        const al = addrLabel(u);
        return `<button class="schip st-${String(x.ev.st||'Scheduled').replace(' ','')}" data-ev="${x.ev.id}" style="grid-column:${x.s+2} / span ${x.e-x.s+1};grid-row:${x.lane+1};background:${s.soft};color:${s.t};border-left-color:${s.c}" aria-label="${esc(taskLine(u, x.ev.task))}, ${x.ev.st}">
          ${al?`<b>${esc(al)}</b>`:''}<span>${esc(x.ev.task)}</span></button>`;}).join('')}
      ${evs.length?'':`<div class="empty-week" style="grid-row:1">Nothing scheduled</div>`}
    </div>`;
  });
  $('#sgrid').innerHTML = h;

  // mobile agenda: day strip + list
  $('#daystrip').innerHTML = days.map((d,i)=>{
    const has = wk.some(x=>x.s<=i && x.e>=i);
    return `<button class="${i===ui.mday?'sel':''} ${i===todayIdx?'today':''}" data-mday="${i}" aria-pressed="${i===ui.mday}" aria-label="${fmtLong(d)}">${DN[i]}<b>${d.getDate()}</b>${has?'<i class="has"></i>':'<i class="has" style="opacity:0"></i>'}</button>`;
  }).join('');
  const dayEvs = dedupeEv(wk.filter(x=>x.s<=ui.mday && x.e>=ui.mday));
  $('#alist').innerHTML = dayEvs.length ? dayEvs.map(x=>{ const s=STAGES[SIDX[x.ev.stage]]||STAGES[0], u=unitById(x.ev.unit);
    return `<li><button data-ev="${x.ev.id}"><i class="bar" style="background:${s.c}"></i>
      <span class="t"><b>${esc(taskLine(u, x.ev.task))}</b><span class="meta">${s.name}${x.ev.span>1?` · ${x.ev.span}-day task`:''} · ${x.ev.st}</span></span>
      ${avatar(x.ev.who,u,'sm')}</button></li>`; }).join('')
    : `<li class="placeholder" style="padding:28px 16px">Nothing scheduled for ${fmtLong(days[ui.mday])}</li>`;
}
$('#wPrev').onclick=()=>{ui.week--;closePop();renderSchedule();};
$('#wNext').onclick=()=>{ui.week++;closePop();renderSchedule();};
$('#wToday').onclick=()=>{ui.week=0;ui.mday=(TODAY.getDay()+6)%7;closePop();renderSchedule();};
root.addEventListener('click', e=>{ const b=e.target.closest('[data-mday]'); if(b){ ui.mday=+b.dataset.mday; renderSchedule(); } });

let popEv=null;
const ST = {'Scheduled':tone(270,.02),'In Progress':tone(255,.14),'Done':tone(185,.11),'Blocked':tone(25,.18)};
function openPop(ev, anchor){
  popEv=ev; const u=unitById(ev.unit), p=$('#pop');
  const end=addDays(parse(ev.start),ev.span-1);
  p.innerHTML = `
    <button class="iconbtn x" data-pop="close" aria-label="Close">${ic('x','sm')}</button>
    <h5>${esc(u.addr)}</h5>
    <div class="sub">${esc(ev.task)} ${stageChip(SIDX[ev.stage])}</div>
    <div class="row2">
      <div><label class="l" for="pWho">Assignee</label><select class="input" id="pWho">${assignable().map(([k,m])=>`<option value="${k}" ${k===ev.who?'selected':''}>${m.name}</option>`).join('')}</select>${teamNoteHTML()}</div>
      <div><label class="l" for="pDue">Due</label><div class="datefield"><input class="input" id="pDue" data-date value="${fmtLong(end)}" autocomplete="off"><button type="button" class="dfbtn" data-dp tabindex="-1" aria-label="Open calendar"><svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg></button></div></div>
    </div>
    <label class="l">Status</label>
    <div class="stchips" role="group" aria-label="Status">${Object.keys(ST).map(k=>`<button data-st="${k}" aria-pressed="${ev.st===k}" class="${ev.st===k?'on':''}" style="${ev.st===k?`background:${ST[k].bg};color:${ST[k].t}`:''}">${k}</button>`).join('')}</div>`;
  p.hidden=false; p.classList.remove('show');
  if(!mobile()){
    const r=anchor.getBoundingClientRect(), pw=316, ph=p.offsetHeight;
    let left=Math.min(window.innerWidth-pw-12, Math.max(12, r.left));
    let top=r.bottom+8; if(top+ph>window.innerHeight-12) top=Math.max(12, r.top-ph-8);
    p.style.left=left+'px'; p.style.top=top+'px';
  } else { p.style.left=''; p.style.top=''; }
  requestAnimationFrame(()=>p.classList.add('show'));
  const reopen = () => { const c=root.querySelector(`[data-ev="${ev.id}"]`); if(c) openPop(ev,c); else closePop(); };
  const persistPop = (patch) => {
    Object.assign(ev, patch);
    renderSchedule(); renderMiniWeek(); renderTeamToday();
    if(ev.id!=null) act('update_schedule', { id: String(ev.id), patch: { who: (TEAM[ev.who]&&TEAM[ev.who].name)||ev.who, start: ev.start, span: ev.span, status: ev.st==='In Progress'?'In progress':ev.st } });
    reopen();
  };
  p.querySelector('#pWho').onchange=e=>{ const who=e.target.value; toast(`Reassigned to ${(TEAM[who]&&TEAM[who].name)||who}`); persistPop({who}); };
  p.querySelector('#pDue').onchange=e=>{ const d=parseDate(e.target.value); if(!d){ e.target.value=fmtLong(end); toast('Couldn’t read that date — kept '+fmt(iso(end))); return; } toast('Due '+fmtLong(d)); persistPop({start:iso(addDays(d,-(ev.span-1)))}); };
  p.querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>{ persistPop({st:b.dataset.st}); });
}
function closePop(){ const p=$('#pop'); p.classList.remove('show'); p.hidden=true; popEv=null; }
root.addEventListener('click', e=>{
  const c=e.target.closest('[data-ev]');
  if(c){ const ev=events.find(x=>String(x.id)===String(c.dataset.ev)); if(popEv===ev) closePop(); else openPop(ev,c); return; }
  if(e.target.closest('[data-pop=close]')){ closePop(); return; }
  if(!e.target.closest('#pop') && !e.target.closest('#dp')) closePop();
});
const onWinResize = ()=>{ closePop(); closeDP(); };
window.addEventListener('resize', onWinResize);
const onWinScroll = e=>{ if(mobile() || e.target.closest?.('#dp')) return; if(!e.target.closest?.('#pop')) closePop(); closeDP(); };
window.addEventListener('scroll', onWinScroll, true);

function setView(v){
  ui.view=v; closePop();
  $('#tPipe').classList.toggle('on',v==='pipe'); $('#tSched').classList.toggle('on',v==='sched');
  $('#tPipe').setAttribute('aria-selected',v==='pipe'); $('#tSched').setAttribute('aria-selected',v==='sched');
  $('#pipeView').hidden = v!=='pipe'; $('#schedView').hidden = v!=='sched';
}
$('#tPipe').onclick=()=>setView('pipe');
$('#tSched').onclick=()=>setView('sched');

/* =========================================================
   Activity panel
   ========================================================= */
function renderMiniWeek(){
  const ws=addDays(TODAY, ui.rweek*7 - ((TODAY.getDay()+6)%7)), days=[...Array(7)].map((_,i)=>addDays(ws,i));
  const wk=weekEvents(ws), DN=['Mo','Tu','We','Th','Fr','Sa','Su'];
  $('#mweek').innerHTML = days.map((d,i)=>{
    const has=wk.some(x=>x.s<=i && x.e>=i), isT=iso(d)===iso(TODAY);
    return `<button class="${i===ui.rday?'sel':''} ${isT?'today':''}" data-rday="${i}" aria-pressed="${i===ui.rday}" aria-label="${fmtLong(d)}">${DN[i]}<b>${d.getDate()}</b><i class="has" style="${has?'':'opacity:0'}"></i></button>`;
  }).join('');
  const list=dedupeEv(wk.filter(x=>x.s<=ui.rday && x.e>=ui.rday)).slice(0,7);
  $('#mlist').innerHTML = list.length ? list.map(x=>{ const st=STAGES[SIDX[x.ev.stage]]||STAGES[0], u=unitById(x.ev.unit);
    return `<li><button data-ev="${x.ev.id}"><i class="bar" style="background:${st.c}"></i><span class="t"><b>${esc(taskLine(u, x.ev.task))}</b><span>${esc((TEAM[x.ev.who]&&TEAM[x.ev.who].name)||x.ev.who)} · ${x.ev.st}</span></span></button></li>`; }).join('')
    : `<li class="empty">Nothing scheduled ${fmtLong(days[ui.rday])}</li>`;
}
$('#rPrev').onclick=()=>{ ui.rweek--; renderMiniWeek(); };
$('#rNext').onclick=()=>{ ui.rweek++; renderMiniWeek(); };
$('#rOpen').onclick=()=>{ setNav('onboarding'); ui.week=ui.rweek; ui.mday=ui.rday; setView('sched'); renderSchedule(); scrollMain({behavior:'smooth'}); };
root.addEventListener('click', e=>{ const b=e.target.closest('[data-rday]'); if(b){ ui.rday=+b.dataset.rday; renderMiniWeek(); } });
const upItems = () => {
  const items=[];
  units.forEach(u=>{
    const sid=STAGES[u.stage].id;
    if(u.status.k==='waiting') items.push({key:'appr-'+u.id, unit:u.id, dot:'var(--amber)', title:`Approve ${STAGES[u.stage].name}`, btn:'Approve', when:()=>true});
    else if(u.status.k==='blocked') items.push({key:'blk-'+u.id, unit:u.id, dot:'var(--red)', title:u.blockReason||'Blocked', btn:'View', when:()=>true});
    else if(u.flags) items.push({key:'flg-'+u.id, unit:u.id, dot:'var(--red)', title:'Needs attention', btn:'View', when:()=>true});
    else if(sid==='client' && u.status.k!=='ready') items.push({key:'cli-'+u.id, unit:u.id, dot:STAGES[SIDX.client].c, title:'Client approval pending', btn:'Follow up', when:()=>true});
  });
  return items.filter(x=>ui.upDone[x.key] || x.when());
};
function renderUpNext(){
  const items=upItems();
  $('#upCount').textContent = `${items.filter(x=>!ui.upDone[x.key]).length} open`;
  $('#upnext').innerHTML = (items.length?'':'<div class="upitem"><div class="t"><span>Nothing waiting on you right now.</span></div></div>') + items.map(x=>{
    const u=unitById(x.unit), done=ui.upDone[x.key];
    const inner = x.btn==='Approve' ? `<span class="lbl">${done||'Approve'}</span>${swapIcon('arrow','check')}` : `<span class="lbl">${done||x.btn}</span>`;
    return `<div class="upitem ${done?'done':''}">
      <i class="dot" style="background:${done?'var(--grey)':x.dot}"></i>
      <div class="t"><b>${x.title}</b><span>${esc(u.addr)}</span></div>
      <button class="btn sm ${done?'ok':''} ${x.btn==='Approve'?'cta-go':''}" data-act="up" data-key="${x.key}" ${done?'disabled':''}>${inner}</button>
    </div>`;}).join('');
  if(ui.upDone.k1){ const s=root.querySelector('[data-key=k1] .swap'); if(s) s.classList.add('on'); }
}
function upAction(key, btn){
  const x=upItems().find(i=>i.key===key) || {unit:key.replace(/^(appr|blk|flg|cli)-/,''), btn:'View'};
  if(x.btn==='Approve'){ approve(x.unit, btn, key); return; }
  if(x.btn==='Follow up'){ openDraft(x.unit, key); return; }
  goToUnit(x.unit);
}
function goToUnit(id){
  setNav('onboarding'); setView('pipe'); ui.open.add(id); renderPipeline();
  const el=root.querySelector(mobile()?`[data-card="${id}"]`:`tr[data-row="${id}"]`);
  if(el){ el.scrollIntoView({behavior:'smooth',block:'start'}); flashUnit(id); }
}
function renderTeamToday(){
  const todayIso = iso(TODAY);
  $('#teamToday').innerHTML = [...SCHED_TEAM,'admin'].map(who=>{
    const m=TEAM[who]||{name:who,role:'',color:ok(270,.02,.5),ini:'?'}; let work, active;
    if(who==='admin'){
      const q=units.filter(u=>['ready','skipped'].includes(u.status.k)).length;
      work=`Review queue · ${q} ready`; active=true;
    } else {
      const evs=events.filter(ev=>ev.who===who && ev.st!=='Done' && ev.start===todayIso);
      const taskBits=[];
      units.forEach(u=>{
        (u.tasks||[]).forEach(t=>{
          if(t.who===who && t.due===todayIso && !t.done && !t.na){ const line=taskLine(u, t.name); if(line) taskBits.push(line.toLowerCase()); }
        });
      });
      const seen=new Set();
      const bits=[...evs.map(ev=>{
        const u=unitById(ev.unit); const line=taskLine(u, ev.task); return line ? line.toLowerCase() : '';
      }), ...taskBits].filter(b=>{ if(!b || seen.has(b)) return false; seen.add(b); return true; });
      active=bits.length>0;
      work = active ? bits.join(', ') : 'Not assigned today';
    }
    return `<div class="tm">${avatar(who)}<div class="t"><b>${m.name}</b><span class="${active?'':'off'}">${esc(work)}</span></div><i class="dot" style="background:${active?'var(--green)':'oklch(0.85 0.005 285)'}" title="${active?'Active today':'Not assigned today'}"></i></div>`;
  }).join('');
}

/* Follow-up draft — opens for review, never sends */
let draftCtx=null;
function openDraft(id, key){
  const u=unitById(id), L=u.lines, ok=L.filter(l=>l.client==='approved').length, open=L.filter(l=>l.client==='pending').length;
  draftCtx={u,key};
  $('#dLede').textContent=`To ${u.owner} · ${u.addr} · via WhatsApp. Nothing is sent from here — review it, then send it yourself.`;
  $('#dText').value = `Hi, it’s Mandel Realty Group following up on the furniture plan for ${u.addr}.\n\n`
    + (!L.length ? `Could you review the furniture plan and budget when you have a moment?`
       : open ? `You’ve approved ${ok} of ${L.length} items so far. Could you look over the remaining ${open} item${open===1?'':'s'} and confirm the total budget when you have a moment?`
       : `Thanks for going through every item. Could you confirm the total budget of ${money(u.lines.filter(l=>l.client!=='declined').reduce((a,l)=>a+lineTotal(l),0))} so we can place the orders?`)
    + `\n\nHappy to jump on a quick call if anything needs changing.\n\nThanks!`;
  $('#draftScrim').classList.add('show');
  setTimeout(()=>$('#dText').focus(),60);
}
function closeDraft(){ $('#draftScrim').classList.remove('show'); }
function markDrafted(){ if(draftCtx){ ui.upDone[draftCtx.key]='Drafted'; renderUpNext(); } closeDraft(); }
$('#dCancel').onclick=closeDraft;
$('#draftScrim').addEventListener('mousedown',e=>{ if(e.target.id==='draftScrim') closeDraft(); });
$('#dCopy').onclick=async()=>{ try{ await navigator.clipboard.writeText($('#dText').value); }catch(_){ $('#dText').select(); try{ document.execCommand('copy'); }catch(__){} } toast('Copied — paste it into WhatsApp to send'); markDrafted(); };
$('#dWa').onclick=()=>{
  const digits=(draftCtx.u.handoff.whatsapp||draftCtx.u.phone||'').replace(/\D/g,''), num=digits.length===10?'1'+digits:digits;
  window.open(`https://wa.me/${num}?text=${encodeURIComponent($('#dText').value)}`,'_blank','noopener');
  toast('Opened in WhatsApp — review and send it there'); markDrafted();
};

/* Quick add (assign task) */
function fillSelects(){
  $('#qaProp').innerHTML = units.map(u=>`<option value="${u.id}">${esc(u.addr)}</option>`).join('');
  const team = assignable().map(([k,m])=>`<option value="${k}">${m.name} — ${m.role}</option>`).join('');
  root.querySelectorAll('[data-teamnote]').forEach(el=>el.innerHTML=teamNoteHTML());
  $('#qaWho').innerHTML = assignable().map(([k,m])=>`<option value="${k}">${m.name}</option>`).join(''); $('#fWho').innerHTML = team;
}
function openQA(){ const f=$('#qaForm'); f.hidden=false; $('#qaBtn').setAttribute('aria-expanded','true'); $('#qaDue').value=''; $('#qaDue').dispatchEvent(new Event('input')); $('#qaTask').focus(); }
$('#qaBtn').onclick=()=>{ $('#qaForm').hidden ? openQA() : ($('#qaForm').hidden=true, $('#qaBtn').setAttribute('aria-expanded','false')); };
$('#qaCancel').onclick=()=>{ $('#qaForm').hidden=true; $('#qaBtn').setAttribute('aria-expanded','false'); };
bindClean($('#qaDue'), $('#qaDueHint'), dateRule, {empty:'Blank = tomorrow'});
$('#qaForm').onsubmit=e=>{
  e.preventDefault();
  const name=$('#qaTask').value.trim().replace(/\s+/g,' '); if(!name){ $('#qaTask').focus(); return; }
  const raw=$('#qaDue').value.trim(), d = raw ? parseDate(raw) : addDays(TODAY,1);
  if(!d){ $('#qaDue').focus(); return; }
  const u=unitById($('#qaProp').value), who=$('#qaWho').value, due=iso(d);
  const clean = name.charAt(0).toUpperCase()+name.slice(1);
  const whoName=(TEAM[who]&&TEAM[who].name)||who;
  const stageName=STAGE_TO_NAME[STAGES[u.stage].id]||STAGES[u.stage].name;
  $('#qaTask').value=''; $('#qaForm').hidden=true; $('#qaBtn').setAttribute('aria-expanded','false');
  act('add_schedule', { unit_id: u.id, who: whoName, stage: stageName, task: clean, start: due, span: 1, status: 'Scheduled' })
    .then(()=> toast(`Assigned to ${whoName} · due ${fmt(due)}`));
};

/* =========================================================
   Add Unit modal
   ========================================================= */
let lastFocus=null;
function furnOptsHTML(name, u){
  const okp=['Standard','Full Service'].includes(u.plan), v=okp?(u.furniture||'none'):'none', lic=(u.handoff||{}).strLicence;
  const opt=(val,b,d)=>`<label class="furnopt"><input type="radio" name="${name}" value="${val}" ${v===val?'checked':''} ${okp?'':'disabled'}><span><b>${b}</b>${d}</span></label>`;
  return opt('none','None','No furniture program') + opt('client','Client-funded','Client has a budget')
    + `<div class="field" data-fx="client" ${v==='client'?'':'hidden'}><label>Client budget — $<input class="input" data-k="furnBudget" inputmode="decimal" value="${u.furnitureBudget||''}" placeholder="e.g. 4,500" autocomplete="off"></label></div>`
    + opt('fip','Furniture Investment Program','MRG funds the furniture. $0 upfront for the owner. Furniture transfers to owner free after 24 months. Requires a valid STR permit and team approval.')
    + `<div class="hint bad" data-fx="fipwarn" ${v==='fip'&&!lic?'':'hidden'}>FIP requires a valid STR permit — add licence below.</div>`
    + opt('contest','Contest unit','Capped package (cap to be set). No repayment. Client locked into contract. MRG selects winner.')
    + `<div class="furnoff hint" data-fx="off" ${okp?'hidden':''}>Furniture program is only available on Standard and Full Service plans</div>`;
}
function syncFurnBox(box, plan, licence){
  const okp = ['Standard','Full Service'].includes(plan);
  box.classList.toggle('disabled', !okp);
  box.querySelectorAll('input[type=radio]').forEach(r=>{ r.disabled=!okp; });
  if(!okp){ const n=box.querySelector('input[value=none]'); if(n) n.checked=true; }
  const fv=(box.querySelector('input[type=radio]:checked')||{}).value||'none';
  box.querySelector('[data-fx=client]').hidden = fv!=='client';
  box.querySelector('[data-fx=fipwarn]').hidden = !(fv==='fip' && !String(licence||'').trim());
  box.querySelector('[data-fx=off]').hidden = okp;
  return fv;
}
const radioVal = n => (root.querySelector(`input[name=${n}]:checked`)||{}).value;
const furnVal = () => (root.querySelector('input[name=fFurn]:checked')||{}).value || 'none';
function syncFurniture(){
  const fv = syncFurnBox($('#furnWrap'), $('#fPlan').value, $('#fStr').value);
  const f=$('#fPlan').value, furnished = fv!=='none';
  $('#fGrowthTier').hidden = f!=='Growth'; $('#fEssTier').hidden = f!=='Essentials';
  $('#flowHint').textContent =
    (f==='Standard'||f==='Full Service') ? (furnished ? '9 stages · full onboarding + furniture' : '5 stages · audit, photography, setup, software, live')
    : f==='Growth' ? '5 stages · audit, app setup, benchmark, software, live'
    : '4 stages · audit, app setup, software, live';
}
/* ---------- Entry choice → CRM picker or manual form ---------- */
function showScrim(id){ $('#'+id).classList.add('show'); }
function hideScrim(id){ $('#'+id).classList.remove('show'); }
const nr = v => v ? esc(v) : '<span class="gaptext">Not recorded</span>';
const personName = k => k ? ((TEAM[k]&&TEAM[k].name)||k) : '';
const STAGE_TONE = {new:[255,.14], booked:[300,.14], sold:[155,.13], lost:[270,.02]};
const CON_TONE = {signed:[155,.13], sent:[65,.14], not_sent:[25,.18]};
const tchip = (txt,t) => { const c=tone(t[0],t[1]); return `<span class="chip" style="background:${c.bg};color:${c.t}">${esc(txt)}</span>`; };
const leadStageChip = l => tchip(l.stage||'New', STAGE_TONE[l.stageGroup]||STAGE_TONE.new);
const contractChip = c => c ? tchip(CONTRACT[c]||c, CON_TONE[c]||CON_TONE.sent) : '<span class="gaptext">Not recorded</span>';
function onbStatus(l){
  const u = l.unitId ? unitById(l.unitId) : null;
  if(!u) return null;
  const act=getActiveStages(u);
  return u.status.k==='done' ? 'Live' : `${STAGES[u.stage].name}, step ${act.indexOf(STAGES[u.stage].id)+1} of ${act.length}`;
}
function openStart(){
  const ready=leads.filter(l=>l.eligibility==='ready').length;
  $('#sCrmCount').textContent = ready ? `${ready} sold client${ready===1?'':'s'} ready` : 'No sold clients waiting';
  closePop(); showScrim('startScrim'); setTimeout(()=>{ const b=root.querySelector('[data-path=crm]'); if(b) b.focus(); },60);
}
function pickCard(l){
  const st=onbStatus(l), ready=l.eligibility==='ready';
  const action = l.unitId ? `<span class="chip amberchip">${ic('alert','sm')}Already in onboarding${st?` · ${esc(st)}`:''}</span><button type="button" class="btn sm" data-act="openUnit" data-u="${esc(l.unitId)}">Open unit →</button>`
    : ready ? `<button type="button" class="btn sm primary" data-act="pickLead" data-l="${esc(l.id)}">Use this client</button>`
    : `<span class="meta">Sale not closed yet</span>`;
  return `<li class="pick ${l.unitId?'done':ready?'ready':'off'}">
    <div class="ptop"><div class="prop"><b>${esc(l.name)}</b><span class="meta">${l.addr?esc(l.addr):'No address yet'}</span></div>${leadStageChip(l)}</div>
    <dl class="pgrid">
      <div><dt>Source</dt><dd>${nr(l.source)}</dd></div><div><dt>Phone</dt><dd>${nr(l.phone)}</dd></div><div><dt>Email</dt><dd>${nr(l.email)}</dd></div>
      <div><dt>Booked by</dt><dd>${nr(l.bookedBy)}</dd></div><div><dt>Closed by</dt><dd>${nr(l.closedBy)}</dd></div><div><dt>Call date</dt><dd>${l.callDate?fmt(l.callDate):'<span class="gaptext">Not recorded</span>'}</dd></div>
      <div><dt>Plan</dt><dd>${nr(l.plan)}</dd></div><div><dt>Contract</dt><dd>${contractChip(l.contract)}</dd></div>
    </dl>
    <div class="pact">${action}</div>
  </li>`;
}
function renderPick(){
  const q=($('#pickQ').value||'').trim().toLowerCase();
  const m=leads.filter(l=>!q || [l.name,l.addr,l.phone,l.email,l.source].join(' ').toLowerCase().includes(q));
  const g=[['Sold, ready to onboard', m.filter(l=>l.eligibility==='ready')],['Already in onboarding', m.filter(l=>l.unitId)],['Not sold yet', m.filter(l=>l.eligibility==='not_sold')]];
  $('#pickList').innerHTML = m.length ? g.filter(x=>x[1].length).map(([t,L])=>`<h5 class="pgh">${t} <span class="count">${L.length}</span></h5><ul>${L.map(pickCard).join('')}</ul>`).join('')
    : `<div class="fempty">${leads.length?'No leads match.':'No leads in the CRM yet.'} <button type="button" class="linkbtn" data-path="manual">Add manually instead</button></div>`;
}
$('#pickQ').addEventListener('input',renderPick);
function openPicker(){ hideScrim('startScrim'); $('#pickQ').value=''; renderPick(); showScrim('pickScrim'); setTimeout(()=>$('#pickQ').focus(),60); }
['startScrim','pickScrim'].forEach(id=>$('#'+id).addEventListener('mousedown',e=>{ if(e.target.id===id) hideScrim(id); }));

/* The lead and sale fields. People are picked from the team; a name the CRM holds that is not on the team is kept as typed. */
function teamOpts(sel){
  const key = sel ? teamKeyFromName(sel) : '';
  const known = !!(key && key!=='admin' && key!=='owner' && TEAM[key]);
  return `<option value="">Choose…</option>${Object.entries(TEAM).filter(([k])=>k!=='admin').map(([k,m])=>`<option value="${k}" ${known&&k===key?'selected':''}>${esc(m.name)}</option>`).join('')}${sel&&!known?`<option value="${esc(sel)}" selected>${esc(sel)}</option>`:''}`;
}
const nameOf = v => v ? ((TEAM[v]&&TEAM[v].name)||v) : '';
function syncLeadSale(){
  $('#fRefWrap').hidden = $('#fSource').value!=='Referral';
  const c=radioVal('fCStat');
  $('#fCWarn').hidden = !c || c==='signed';
  if(c==='signed') $('#fCConfirm').checked=false;
}
function openModal(mode='manual', lead=null){
  ui.formMode=mode; ui.formLead=lead?lead.id:null;
  lastFocus=document.activeElement;
  $('#unitForm').reset();
  $('#fSource').innerHTML = SOURCES.map(x=>`<option>${x}</option>`).join('');
  $('#fBooked').innerHTML = teamOpts(lead?lead.bookedBy:''); $('#fClosed').innerHTML = teamOpts(lead?lead.closedBy:'');
  root.querySelectorAll('#unitForm [data-gap]').forEach(g=>g.hidden=true);
  root.querySelectorAll('#unitForm .isgap').forEach(g=>g.classList.remove('isgap'));
  $('#fPlanWrap').classList.remove('err'); $('#fCSet [data-req]').hidden=true;
  $('#fMkLeadWrap').hidden = mode==='crm';
  $('#mTitle').textContent = mode==='crm' ? 'Start onboarding from CRM' : 'Start onboarding: add manually';
  if(mode==='crm' && lead){
    $('#fAddr').value=lead.addr||''; $('#fOwner').value=lead.name||''; $('#fPhone').value=lead.phone||''; $('#fEmail').value=lead.email||'';
    if(SOURCES.includes(lead.source)) $('#fSource').value=lead.source; else $('#fSource').value='Other';
    $('#fRef').value=lead.referredBy||'';
    if(lead.plan && [...$('#fPlan').options].some(o=>o.value===lead.plan)) $('#fPlan').value=lead.plan;
    if(lead.contract){ const r=root.querySelector(`input[name=fCStat][value=${lead.contract}]`); if(r) r.checked=true; }
    const gaps=[];
    if(!lead.plan) gaps.push('plan');
    if(!lead.contract) gaps.push('contract');
    if(!lead.addr) gaps.push('address');
    gaps.push('handoff');
    gaps.forEach(g=>{ const el=root.querySelector(`#unitForm [data-gap=${g}]`); if(el) el.hidden=false; });
    if(!lead.plan) $('#fPlanWrap').classList.add('isgap');
    if(!lead.contract) $('#fCSet').classList.add('isgap');
    if(!lead.addr) $('#fAddrWrap').classList.add('isgap');
    const filled=[lead.addr,lead.name,lead.phone,lead.email,lead.source,lead.bookedBy,lead.closedBy,lead.plan,lead.contract].filter(Boolean).length;
    const ng=gaps.length;
    $('#fSrcBanner').innerHTML = `<div class="sbl">${ic('users','sm')}<span><b>From CRM: ${esc(lead.name)}</b><span class="meta">${filled} details filled in from the CRM. ${ng} gap${ng===1?'':'s'} flagged below.</span></span></div><button type="button" class="btn sm ghost" data-path="crm">Change client</button>`;
  } else {
    $('#fSource').value='Referral';
    $('#fSrcBanner').innerHTML = `<div class="sbl">${ic('plus','sm')}<span><b>Added manually</b><span class="meta">For referrals and walk-ins that are not in the CRM yet.</span></span></div><button type="button" class="btn sm ghost" data-path="crm">Pick from CRM instead</button>`;
  }
  syncLeadSale();
  $('#fContractName').textContent='Upload signed agreement'; $('#fStart').value='today'; $('#fWho').value='fa1';
  ['#fAddrWrap','#fOwnerWrap'].forEach(s=>$(s).classList.remove('err'));
  const c=$('#mCreate'); c.disabled=false; c.classList.add('primary'); c.classList.remove('ok','pushed'); c.querySelector('.swap').classList.remove('on'); c.firstChild.textContent='Create Unit';
  ['#fAddr','#fOwner','#fPhone','#fStart'].forEach(s=>$(s).dispatchEvent(new Event('input')));
  syncFurniture(); $('#overlay').classList.add('show'); $('#unitForm').scrollTop=0;
  setTimeout(()=>$('#fAddr').focus(),60);
}
function modalDirty(){
  const overlay=$('#overlay'); if(!overlay || !overlay.classList.contains('show')) return false;
  const keys=['#fAddr','#fOwner','#fPhone','#fEmail','#fRef','#fFeeAmt','#fFeeWhy','#fNotes','#fStr','#hParking','#hWifi','#hWifiPw','#hIssues','#hAlarm'];
  if(keys.some(s=>{ const el=$(s); return el && String(el.value||'').trim(); })) return true;
  if(($('#fContract').files||[]).length) return true;
  return false;
}
function closeModal(force){
  if(!$('#overlay').classList.contains('show')) return;
  if(!force && modalDirty() && !confirm('Discard this unit? Your entries will be lost.')) return;
  $('#overlay').classList.remove('show'); if(lastFocus) lastFocus.focus?.();
}
$('#mCancel').onclick=()=>closeModal();
$('#overlay').addEventListener('mousedown',e=>{ if(e.target.id==='overlay') closeModal(); });
$('#fPlan').onchange=()=>{ $('#fPlanWrap').classList.remove('err'); syncFurniture(); };
$('#fSource').addEventListener('change',syncLeadSale);
root.querySelectorAll('input[name=fCStat]').forEach(r=>r.addEventListener('change',()=>{ $('#fCSet [data-req]').hidden=true; syncLeadSale(); }));
$('#fCConfirm').addEventListener('change',()=>$('#fCWarn').classList.remove('shake'));
$('#fContract').addEventListener('change',()=>{ const f=$('#fContract').files[0]; $('#fContractName').textContent = f ? f.name : 'Upload signed agreement'; });
$('#fStr').addEventListener('input',syncFurniture);
root.querySelectorAll('input[name=fFurn]').forEach(r=>r.addEventListener('change',syncFurniture));
bindClean($('#fAddr'), $('#fAddrHint'), v=>({ok:true,label:v.trim(),clean:null}), {empty:'Google Places autocomplete — type or pick a suggestion'});
bindClean($('#fOwner'), $('#fOwnerHint'), v=>({ok:true,label:'Saves as '+cleanName(v),clean:cleanName(v)}));
bindClean($('#fPhone'), $('#fPhoneHint'), v=>{ const p=cleanPhone(v); return p.ok?{ok:true,label:'Saves as '+p.v,clean:p.v}:{ok:false,label:'Needs 10 digits — saved as typed'}; });
bindClean($('#fStart'), $('#fStartHint'), dateRule);
$('#unitForm').onsubmit=e=>{
  e.preventDefault();
  const addr=String($('#fAddr').value||'').replace(/\s+/g,' ').trim(), owner=cleanName($('#fOwner').value);
  $('#fAddrWrap').classList.toggle('err',!addr); $('#fOwnerWrap').classList.toggle('err',!owner);
  if(!addr||!owner){ (addr?$('#fOwner'):$('#fAddr')).focus(); return; }
  if(!$('#fPlan').value){ $('#fPlanWrap').classList.add('err'); $('#fPlan').focus(); return; }
  const cstat=radioVal('fCStat');
  if(!cstat){ $('#fCSet [data-req]').hidden=false; $('#fCSet').scrollIntoView({block:'center',behavior:'smooth'}); return; }
  if(cstat!=='signed' && !$('#fCConfirm').checked){ const w=$('#fCWarn'); w.classList.remove('shake'); void w.offsetWidth; w.classList.add('shake'); w.scrollIntoView({block:'center',behavior:'smooth'}); $('#fCConfirm').focus({preventScroll:true}); return; }
  const lead = ui.formMode==='crm' ? leadById(ui.formLead) : null;
  if(lead && lead.unitId){ closeModal(true); toast(`${lead.name} is already in onboarding`); goToUnit(lead.unitId); return; }
  const pl=$('#fPlan').value, tierBox = pl==='Growth' ? $('#fGrowthTier') : pl==='Essentials' ? $('#fEssTier') : null;
  root.querySelectorAll('.tierset [data-req]').forEach(x=>x.hidden=true);
  if(tierBox && !tierBox.querySelector('input:checked')){ tierBox.querySelector('[data-req]').hidden=false; tierBox.scrollIntoView({block:'center',behavior:'smooth'}); tierBox.querySelector('input').focus({preventScroll:true}); return; }
  const start = parseDate($('#fStart').value) || TODAY;
  const beds=$('#fBeds').value, t=$('#fType').value.replace('Condo/Apartment','Condo');
  const whoKey=$('#fWho').value;
  const assigneeName=(TEAM[whoKey]&&TEAM[whoKey].name)||whoKey;
  const planTier = pl==='Essentials' ? radioVal('fETier') : pl==='Growth' ? radioVal('fGTier') : undefined;
  const furniture = furnVal();
  const furnitureBudget = furniture==='client' ? (parseFloat($('#furnWrap [data-k=furnBudget]').value.replace(/[^0-9.]/g,''))||0) : undefined;
  const alarmRaw = ($('#hAlarm').value||'').trim();
  const handoffPatch = {
    access_method: $('#hAccess').value || null,
    alarm_type: !alarmRaw || /^none$/i.test(alarmRaw) ? 'none' : 'Has alarm',
    alarm_instructions: !alarmRaw || /^none$/i.test(alarmRaw) ? null : alarmRaw,
    parking_spot: ($('#hParking').value||'').trim() || null,
    wifi_name: ($('#hWifi').value||'').trim() || null,
    wifi_password: ($('#hWifiPw').value||'').trim() || null,
    known_issues: ($('#hIssues').value||'').trim().replace(/\s+/g,' ') || null,
  };
  const noteText = ($('#fNotes').value||'').trim();
  const contractFile = ($('#fContract').files||[])[0] || null;
  const fee = radioVal('fFee')||'TBC';
  const feeAmt = fee==='Charged' ? (parseFloat(String($('#fFeeAmt').value||'').replace(/[^0-9.]/g,''))||0) : 0;
  const createLead = !lead && $('#fMkLead').checked;
  const c=$('#mCreate'); c.disabled=true; c.classList.remove('primary'); c.classList.add('ok','pushed'); c.querySelector('.swap').classList.add('on'); c.firstChild.textContent='Created ';
  const finish = (res) => {
    closeModal(true);
    if(res && res.unit_id){ goToUnit(res.unit_id); }
    toast(`${addr} started at Audit${(lead||(res&&res.lead_id))?' · linked to CRM':''}`);
  };
  const resetBtn = () => {
    c.disabled=false; c.classList.add('primary'); c.classList.remove('ok','pushed');
    const sw=c.querySelector('.swap'); if(sw) sw.classList.remove('on');
    c.firstChild.textContent='Create Unit';
  };
  const afterCreate = (res) => {
    const id = res && res.unit_id;
    if(!id) return Promise.resolve(res);
    const chain = [];
    const hasHandoff = Object.values(handoffPatch).some(v => v!=null && v!=='' && v!=='none');
    if(hasHandoff) chain.push(() => act('update_handoff', { unit_id: id, patch: handoffPatch }));
    if(noteText) chain.push(() => act('add_note', { unit_id: id, text: noteText, stage: 'Audit' }));
    const run = (i) => i>=chain.length ? Promise.resolve(res) : chain[i]().then(() => run(i+1));
    const withDoc = () => {
      if(!contractFile) return run(0);
      return readFileDataUrl(contractFile).then(url => act('add_doc', { unit_id: id, name: contractFile.name, url, doc_type: 'agreement' })).then(() => run(0));
    };
    return withDoc().then(() => res);
  };
  // The create itself talks to the server directly, so a "already in onboarding" answer can open the existing unit.
  host.act('add_unit', {
    address: addr,
    type: `${beds} ${t}`,
    owner,
    assignee: assigneeName,
    plan: pl,
    plan_tier: planTier,
    furniture,
    furniture_budget: furnitureBudget,
    owner_phone: cleanPhone($('#fPhone').value).v,
    owner_email: ($('#fEmail').value||'').trim().toLowerCase() || undefined,
    str_licence: $('#fStr').value.trim().toUpperCase() || undefined,
    str_permit_status: $('#fPermit').value || undefined,
    started_on: iso(start),
    lead_source: $('#fSource').value,
    referred_by: $('#fSource').value==='Referral' ? cleanName($('#fRef').value) : undefined,
    booked_by: nameOf($('#fBooked').value) || undefined,
    closed_by: nameOf($('#fClosed').value) || undefined,
    contract_status: cstat,
    onboarding_fee_status: fee.toLowerCase(),
    onboarding_fee_amount: feeAmt || undefined,
    onboarding_fee_reason: fee==='Waived' ? ($('#fFeeWhy').value||'').trim() : undefined,
    lead_id: lead ? lead.id : undefined,
    create_lead: createLead,
  }).then(res=>host.load().then(d=>{ reload(d); return res; }))
    .then(afterCreate).then(finish)
    .catch(err=>{
      if(err && err.existing_unit_id){ closeModal(true); toast(err.message||'This client is already in onboarding'); host.load().then(d=>{ reload(d); goToUnit(err.existing_unit_id); }); return; }
      if(host.onError) host.onError(err);
    })
    .finally(resetBtn);
};

/* =========================================================
   Command palette (⌘K / Ctrl K)
   ========================================================= */
const cmd = {items:[], act:0};
const cmdkOpen = () => $('#cmdkScrim').classList.contains('show');
function cmdItems(){
  const out=[];
  out.push({g:'Actions', icon:'plus', label:'Start onboarding', sub:'From CRM or add manually', run:openStart});
  out.push({g:'Actions', icon:'users', label:'New CRM lead', sub:'CRM', run:()=>{ if(host.openCrmLeadForm) host.openCrmLeadForm(); }});
  leads.forEach(l=>out.push({g:'People', icon:'users', label:l.name, sub:`CRM lead · ${l.addr||l.source||''}`, run:()=>{ if(host.openLead) host.openLead(l.id); }}));
  out.push({g:'Actions', icon:'plus', label:'Assign a task', sub:'Quick add', run:()=>{ setNav('onboarding'); openQA(); $('#qaForm').scrollIntoView({block:'center'}); }});
  out.push({g:'Actions', icon:'cal',  label:'Open schedule', sub:'This week', run:()=>{ setNav('onboarding'); setView('sched'); }});
  units.forEach(u=>out.push({g:'Properties', icon:'building', label:u.addr, sub:`${(STAGES[u.stage]||STAGES[0]).name} · ${esc((TEAM[u.assignee]&&TEAM[u.assignee].name)||u.assignee||'Unassigned')}`, run:()=>goToUnit(u.id)}));
  STAGES.forEach((s,i)=>{ const at=units.filter(u=>u.stage===i); out.push({g:'Steps', icon:'step', label:s.name, sub: at.length?at.map(u=>short(u.addr)).join(', '):'No units here', dot:s.c, run:()=>{ if(!at.length){ toast(`No units at ${s.name}`); return; } at.forEach(u=>ui.open.add(u.id)); goToUnit(at[0].id); }}); });
  units.forEach(u=>u.tasks.forEach(t=>out.push({g:'Steps', icon:'clip', label:t.name, sub:short(u.addr), deep:true, run:()=>goToUnit(u.id)})));
  Object.entries(TEAM).forEach(([k,m])=>out.push({g:'People', avatar:k, label:m.name, sub:m.role, run:()=>{
    setNav('onboarding');
    if(SCHED_TEAM.includes(k)){ setView('sched'); ui.week=0; renderSchedule(); requestAnimationFrame(()=>{ const r=root.querySelector(`[data-member="${k}"]`); if(r&&!mobile()){ r.scrollIntoView({block:'center',behavior:'smooth'}); r.classList.add('flash'); setTimeout(()=>r.classList.remove('flash'),800);} }); }
    else { setView('pipe'); toast(`${units.filter(u=>u.status.k==='ready').length} ready to advance`); }
  }}));
  ALL_NAV.forEach(n=>out.push({g:'Go to', icon:n.icon, label:n.label, sub:'Section', run:()=>setNav(n.id)}));
  out.push({g:'Go to', icon:'gear', label:'CRM Settings', sub:'CRM', run:()=>{ if(host.go) host.go('crm', { crmTab: 'settings' }); }});
  return out;
}
function score(it,q){
  const L=it.label.toLowerCase(), S=(it.sub||'').toLowerCase();
  const toks=q.split(/\s+/).filter(Boolean); let sc=0;
  for(const t of toks){ const i=L.indexOf(t); if(i===0) sc+=3; else if(i>0) sc+=2; else if(S.includes(t)) sc+=1; else return -1; }
  return sc;
}
function renderCmdk(){
  const q=$('#cmdkQ').value.trim().toLowerCase();
  let list = cmdItems();
  list = q ? list.map(it=>({it,s:score(it,q)})).filter(x=>x.s>=0).sort((a,b)=>b.s-a.s).map(x=>x.it)
           : list.filter(it=>!it.deep && it.g!=='Go to' && it.g!=='Steps');
  const groups=['Actions','Properties','Steps','People','Go to'];
  cmd.items=[]; let h='';
  groups.forEach(g=>{
    const its=list.filter(it=>it.g===g).slice(0,7);             // chunk: ≤ 7 per group
    if(!its.length) return;
    h+=`<div class="grp">${g}</div>`;
    its.forEach(it=>{ const i=cmd.items.length; cmd.items.push(it);
      const lead = it.avatar ? avatar(it.avatar,null,'sm') : `<span class="ico" ${it.dot?`style="color:${it.dot}"`:''}>${ic(it.icon,'sm')}</span>`;
      h+=`<button class="it ${i===cmd.act?'act':''}" role="option" aria-selected="${i===cmd.act}" data-ci="${i}">${lead}<span>${esc(it.label)}</span><span class="s">${esc(it.sub||'')}</span></button>`; });
  });
  $('#cmdkRes').innerHTML = h || `<div class="empty">Nothing matches “${esc(q)}”. Try an address, a stage, or a name.</div>`;
}
function openCmdk(){ closePop(); cmd.act=0; $('#cmdkQ').value=''; renderCmdk(); $('#cmdkScrim').classList.add('show'); setTimeout(()=>$('#cmdkQ').focus(),30); }
function closeCmdk(){ $('#cmdkScrim').classList.remove('show'); }
function runCmd(i){ const it=cmd.items[i]; if(!it) return; closeCmdk(); setTimeout(()=>it.run(),60); }
$('#cmdkQ').addEventListener('input',()=>{ cmd.act=0; renderCmdk(); });
$('#cmdkQ').addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); const n=cmd.items.length; if(!n) return; cmd.act=(cmd.act+(e.key==='ArrowDown'?1:-1)+n)%n; renderCmdk(); root.querySelector('.cmdk .it.act')?.scrollIntoView({block:'nearest'}); }
  if(e.key==='Enter'){ e.preventDefault(); runCmd(cmd.act); }
});
$('#cmdkRes').addEventListener('mousemove',e=>{ const b=e.target.closest('[data-ci]'); if(b && +b.dataset.ci!==cmd.act){ cmd.act=+b.dataset.ci; root.querySelectorAll('.cmdk .it').forEach(x=>x.classList.toggle('act',+x.dataset.ci===cmd.act)); } });
$('#cmdkRes').addEventListener('click',e=>{ const b=e.target.closest('[data-ci]'); if(b) runCmd(+b.dataset.ci); });
$('#cmdkScrim').addEventListener('mousedown',e=>{ if(e.target.id==='cmdkScrim') closeCmdk(); });

/* =========================================================
   Branded date picker — works with any input[data-date]
   ========================================================= */
const dp = {input:null, month:null, sel:null};
function renderDP(){
  const m=dp.month, first=new Date(m.getFullYear(), m.getMonth(), 1);
  const start=addDays(first, -((first.getDay()+6)%7));
  $('#dpMonth').textContent = first.toLocaleDateString('en-CA',{month:'long', year:'numeric'});
  let h='';
  for(let i=0;i<42;i++){
    const d=addDays(start,i), k=iso(d);
    const cls=[d.getMonth()!==m.getMonth()?'out':'', k===iso(TODAY)?'today':'', dp.sel&&k===iso(dp.sel)?'sel':'', d.getDay()%6===0?'we':''].join(' ');
    h+=`<button type="button" class="${cls}" data-dpday="${k}" aria-label="${fmtLong(d)}" ${dp.sel&&k===iso(dp.sel)?'aria-selected="true"':''}>${d.getDate()}</button>`;
  }
  $('#dpDays').innerHTML=h;
}
function openDP(input){
  if(dp.input===input && !$('#dp').hidden) return;
  dp.input=input; dp.sel=parseDate(input.value); dp.month=dp.sel||TODAY;
  renderDP();
  const el=$('#dp'); el.hidden=false; el.classList.remove('show');
  if(!mobile()){
    const r=input.closest('.datefield').getBoundingClientRect(), w=el.offsetWidth, h=el.offsetHeight;
    let left=Math.min(window.innerWidth-w-12, Math.max(12, r.left));
    let top=r.bottom+6; if(top+h>window.innerHeight-12) top=Math.max(12, r.top-h-6);
    el.style.left=left+'px'; el.style.top=top+'px';
  } else { el.style.left=''; el.style.top=''; }
  requestAnimationFrame(()=>el.classList.add('show'));
}
function closeDP(refocus){
  const el=$('#dp'); if(el.hidden) return;
  el.classList.remove('show'); el.hidden=true;
  if(refocus && dp.input && document.contains(dp.input)) dp.input.focus();
  dp.input=null;
}
function pickDP(d){
  const inp=dp.input; if(!inp) return;
  inp.value=fmtLong(d);
  closeDP();
  inp.dispatchEvent(new Event('input',{bubbles:true}));
  inp.dispatchEvent(new Event('change',{bubbles:true}));
}
root.addEventListener('click', e=>{
  const b=e.target.closest('[data-dp]');
  if(b){ e.stopPropagation(); const inp=b.closest('.datefield').querySelector('input'); (!$('#dp').hidden && dp.input===inp) ? closeDP() : openDP(inp); return; }
  const f=e.target.closest('input[data-date]'); if(f){ openDP(f); return; }
  const day=e.target.closest('[data-dpday]'); if(day){ pickDP(parse(day.dataset.dpday)); return; }
  const nav=e.target.closest('[data-dpnav]'); if(nav){ dp.month=new Date(dp.month.getFullYear(), dp.month.getMonth()+(+nav.dataset.dpnav), 1); renderDP(); return; }
  const q=e.target.closest('[data-dpquick]'); if(q){ pickDP(addDays(TODAY,+q.dataset.dpquick)); return; }
  if(!e.target.closest('#dp')) closeDP();
}, true);
root.addEventListener('input', e=>{
  if(e.target.dataset && e.target.dataset.ho==='strLicence'){ const fb=e.target.closest('.dwrap').querySelector('[data-furnbox]'); if(fb){ const u=unitById(fb.dataset.furnbox); syncFurnBox(fb,u.plan,e.target.value); } }
  // typing still works: the calendar follows what was typed
  if(e.target.matches && e.target.matches('input[data-date]') && dp.input===e.target && !$('#dp').hidden){
    const d=parseDate(e.target.value); if(d){ dp.sel=d; dp.month=d; renderDP(); }
  }
});
root.addEventListener('keydown', e=>{
  if(e.key==='Tab' && !$('#dp').hidden && e.target.matches && e.target.matches('input[data-date]')) closeDP();
  if(e.key==='ArrowDown' && e.target.matches && e.target.matches('input[data-date]') && $('#dp').hidden){ e.preventDefault(); openDP(e.target); }
});

/* =========================================================
   PDF viewer
   ========================================================= */
function makePdf(lines){
  const txt=t=>String(t).replace(/[^\x20-\x7E]/g,'-').replace(/[\\()]/g,'\\$&');
  let stream='BT /F1 20 Tf 72 720 Td ('+txt(lines[0])+') Tj ET\n';
  lines.slice(1).forEach((l,i)=>{ stream+='BT /F1 12 Tf 72 '+(686-i*20)+' Td ('+txt(l)+') Tj ET\n'; });
  const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream'];
  let pdf='%PDF-1.4\n', offs=[];
  objs.forEach((o,i)=>{ offs.push(pdf.length); pdf+=(i+1)+' 0 obj\n'+o+'\nendobj\n'; });
  const x=pdf.length;
  pdf+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n'+offs.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('');
  pdf+='trailer\n<< /Size '+(objs.length+1)+' /Root 1 0 R >>\nstartxref\n'+x+'\n%%EOF';
  return new Blob([pdf],{type:'application/pdf'});
}
function docUrl(u,d){
  if(!d.url) d.url=URL.createObjectURL(makePdf([d.name,'Mandel Realty Group','Property: '+u.addr,'Uploaded: '+fmtLong(parse(d.date)),'','Sample document - placeholder for the design mockup.']));
  return d.url;
}
function downloadDoc(u,d){ const l=document.createElement('a'); l.href=docUrl(u,d); l.download=d.name; document.body.appendChild(l); l.click(); l.remove(); toast(`Downloading ${d.name}`); }
let pdfCur=null;
function openPdf(u,d){
  pdfCur={u,d};
  $('#pdfName').textContent=d.name; $('#pdfMeta').textContent=`${u.addr} · uploaded ${fmt(d.date)}`;
  $('#pdfFrame').src=docUrl(u,d)+'#view=FitH';
  $('#pdfScrim').classList.add('show');
  setTimeout(()=>$('#pdfClose').focus(),60);
}
function closePdf(){ $('#pdfScrim').classList.remove('show'); setTimeout(()=>{ if(!$('#pdfScrim').classList.contains('show')) $('#pdfFrame').removeAttribute('src'); }, 260); }
$('#pdfClose').onclick=closePdf;
$('#pdfDown').onclick=()=>{ if(pdfCur) downloadDoc(pdfCur.u, pdfCur.d); };
$('#pdfScrim').addEventListener('mousedown',e=>{ if(e.target.id==='pdfScrim') closePdf(); });

/* =========================================================
   Boot
   ========================================================= */
function renderAll(){
  const run = (fn) => { try { fn(); } catch (err) { console.error(err); if(host.onError) host.onError(err); } };
  run(renderStats); run(renderPipeline); run(renderSchedule); run(renderUpNext); run(renderMiniWeek); run(renderTeamToday);
}
root.querySelectorAll('.kbdk').forEach(k=>k.textContent = isMac ? '⌘K' : 'Ctrl K');
$('#meAv').style.background = TEAM.admin.color;
$('#today').textContent = TODAY.toLocaleDateString('en-CA',{weekday:'long', month:'long', day:'numeric', year:'numeric'});
units.forEach(u=>{ u.handoff=normHandoff(u.handoff); syncClient(u);
  const whoLabel=(TEAM[u.assignee]&&TEAM[u.assignee].name)||u.assignee||'Unassigned';
  const stageLabel=(STAGES[u.stage]||STAGES[0]).name;
  u.history = u.history || [{ts:addDays(TODAY,-u.day).toISOString(), text:`Onboarding started · ${u.plan||'no plan'}`, type:'start'},
                             {ts:addDays(TODAY,-1).toISOString(), text:`${stageLabel} assigned to ${whoLabel}`, type:'start'}]; });
function setPanel(closed){
  root.getRootNode().host.classList.toggle('rp-closed', closed);
  $('#rpOpen').hidden = !closed;
  try{ localStorage.setItem('mrg-rp', closed?'1':'0'); }catch(_){}
  (closed ? $('#rpOpen') : $('#rpClose')).focus({preventScroll:true});
}
$('#rpClose').onclick=()=>setPanel(true);
$('#rpOpen').onclick=()=>setPanel(false);
try{ if(localStorage.getItem('mrg-rp')==='1'){ root.getRootNode().host.classList.add('rp-closed'); $('#rpOpen').hidden=false; } }catch(_){}
function setSidebar(collapsed){
  root.getRootNode().host.classList.toggle('sb-collapsed', collapsed);
  const t=$('#sideTog'); t.setAttribute('aria-expanded', String(!collapsed));
  t.setAttribute('aria-label', collapsed?'Expand sidebar':'Collapse sidebar'); t.title = collapsed?'Expand sidebar':'Collapse sidebar';
  try{ localStorage.setItem('mrg-sb', collapsed?'1':'0'); }catch(_){}
}
$('#sideTog').onclick=()=>setSidebar(!root.getRootNode().host.classList.contains('sb-collapsed'));
try{ if(localStorage.getItem('mrg-sb')==='1') setSidebar(true); }catch(_){}

// Prefer live host data over design sample
try { applyHostData(host.data); } catch (e) { console.warn('host hydrate failed', e); }
renderNav(); fillSelects(); renderAll(); setView('pipe'); ui.booted=true;


// Address autocomplete via host.suggest — list sits in flow under the field so it scrolls with the dialog and does not cover Unit type / Bedrooms
(function(){
  const addr = $('#fAddr');
  if(!addr || !host.suggest) return;
  let box = document.createElement('div');
  box.className = 'suggest';
  box.style.cssText = 'display:none;position:relative;z-index:2;background:#fff;border:1px solid var(--line);border-radius:12px;width:100%;max-height:160px;overflow:auto;margin-top:6px';
  const wrap = addr.parentElement; if(wrap){ wrap.appendChild(box); }
  let t=null;
  const hide = ()=>{ box.style.display='none'; };
  addr.addEventListener('input', ()=>{
    clearTimeout(t);
    const q=addr.value.trim();
    if(q.length<3){ hide(); return; }
    t=setTimeout(()=>{
      host.suggest(q).then(list=>{
        const rows=list||[];
        if(!rows.length){ hide(); return; }
        box.innerHTML = rows.map(p=>`<button type="button" class="btn sm" style="display:block;width:100%;text-align:left;border:0;border-radius:0;background:#fff">${esc(p.description||p)}</button>`).join('');
        box.style.display='block';
        box.querySelectorAll('button').forEach((b,i)=>b.onclick=()=>{ addr.value=rows[i].description||rows[i]; hide(); addr.dispatchEvent(new Event('input',{bubbles:true})); });
      }).catch(()=>{});
    }, 250);
  });
  addr.addEventListener('blur', ()=> setTimeout(hide, 180));
})();

const tb=$('.tablebox'); if(tb) new ResizeObserver(()=>tb.style.setProperty('--boxw', tb.clientWidth+'px')).observe(tb);

function onCmdK(e){
  if(!((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k')) return;
  // Only when this onboarding root is still mounted
  if(!root.isConnected) return;
  // In the hub every page stays loaded; only the page on screen answers.
  if(!root.getClientRects().length) return;
  e.preventDefault();
  cmdkOpen()?closeCmdk():openCmdk();
}
document.addEventListener('keydown', onCmdK);
/* Opened from the CRM: land on a unit, or start onboarding for a lead, as the link asked. */
if(host.open){
  try{
    if(host.open.unit){ goToUnit(host.open.unit); }
    else if(host.open.startLead){ const l=leadById(host.open.startLead); if(l){ if(l.unitId) goToUnit(l.unitId); else openModal('crm', l); } else toast('That CRM lead was not found'); }
  }catch(err){ if(host.onError) host.onError(err); }
}
  return { destroy: function () {
    document.removeEventListener('keydown', onCmdK);
    window.removeEventListener('resize', onWinResize);
    window.removeEventListener('scroll', onWinScroll, true);
    stopAuditPoll();
    root.innerHTML = "";
  } };
}