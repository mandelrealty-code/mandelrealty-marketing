// @ts-nocheck
export const CRM_CSS = ":host{display:block;min-height:100dvh;background:#ffffff}\n\n/* =========================================================\n   Tokens: same as the hub (OKLCH palette, alpha borders, one type scale)\n   ========================================================= */\n:host, :root{\n  --bg:#ffffff; --panel:#f2f2ef;\n  --ink: oklch(0.21 0.006 285); --ink2: oklch(0.32 0.006 285); --muted: oklch(0.45 0.008 285);\n  --line: rgb(0 0 0 / 0.11); --line-2: rgb(0 0 0 / 0.06); --hover: rgb(0 0 0 / 0.04); --press: rgb(0 0 0 / 0.07);\n  --gold:#c4a35a; --primary:#18181b;\n  --blue: oklch(0.6 0.15 255); --amber: oklch(0.6 0.14 65); --red: oklch(0.6 0.19 25); --grey: oklch(0.6 0.015 270);\n  --teal: oklch(0.6 0.11 185); --green: oklch(0.6 0.13 155);\n  --redink: oklch(0.48 0.17 25); --amberink: oklch(0.47 0.12 60); --greenink: oklch(0.42 0.1 155); --tealink: oklch(0.42 0.09 185);\n  --t-xs:12px; --t-sm:13px; --t-base:14px; --t-md:16px; --t-lg:24px;\n  --r-card:16px; --r-ctl:10px; --r-pill:999px;\n  --ease: cubic-bezier(.65,0,.35,1); --fast:110ms; --med:180ms; --slow:260ms;\n  --safe-b: env(safe-area-inset-bottom, 0px);\n  --safe-t: env(safe-area-inset-top, 0px);\n}\n*{box-sizing:border-box}\n[hidden]{display:none!important}\n.crm{margin:0;background:var(--bg);color:var(--ink2);font-family:Inter,system-ui,-apple-system,sans-serif;font-size:var(--t-base);line-height:1.5;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}\nbutton,input,select,textarea{font:inherit;color:inherit}\nbutton{cursor:pointer;-webkit-user-select:none;user-select:none}\nbutton[disabled]{cursor:default}\na{color:inherit}\n::placeholder{color:oklch(0.55 0.008 285)}\n:focus-visible{outline:2px solid oklch(0.6 0.15 255 / .55);outline-offset:2px}\nh1,h2,h3,h4,h5,h6{margin:0;color:var(--ink)}\n.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}\nsvg.i{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}\nsvg.i.sm{width:16px;height:16px}\nsvg.i.xs{width:14px;height:14px}\n\n/* ===================== Shared UI (matches hub) ===================== */\n.card{background:var(--bg);border:1px solid var(--line);border-radius:var(--r-card)}\n.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:var(--r-ctl);padding:0 14px;height:40px;font-size:var(--t-sm);font-weight:500;border:1px solid var(--line);background:var(--bg);color:var(--ink);white-space:nowrap;text-decoration:none;transition:background var(--fast) var(--ease),transform var(--fast) var(--ease)}\n.btn:hover{background:var(--hover)}\n.btn:active{transform:scale(.97);background:var(--press)}\n.btn.sm{height:32px;padding:0 11px;font-size:var(--t-xs);border-radius:8px}\n.btn.primary{background:var(--primary);border-color:transparent;color:#fff;font-weight:600}\n.btn.primary:hover{background:oklch(0.29 0.006 285)}\n.btn.primary svg.i{stroke-width:2.1}\n.btn.ghost{border-color:transparent;background:none;color:var(--ink2)}\n.btn.ghost:hover{background:var(--hover)}\n.btn.danger{background:oklch(0.55 0.17 25);border-color:transparent;color:#fff;font-weight:600}\n.btn.danger:hover{background:oklch(0.5 0.17 25)}\n.btn.dangerline{color:var(--redink);border-color:oklch(0.6 0.19 25 / .35)}\n.btn.ok{background:oklch(0.94 0.05 155);border-color:oklch(0.6 0.13 155 / .35);color:var(--greenink)}\n.btn[disabled],.btn.dis{opacity:.5;pointer-events:none}\n.cta-add .plus{transition:transform var(--slow) var(--ease)}\n.cta-add:hover .plus{transform:rotate(90deg)}\n.iconbtn{position:relative;width:36px;height:36px;border-radius:9px;border:1px solid transparent;background:none;display:inline-grid;place-items:center;color:var(--ink2);flex:none;transition:background var(--fast) var(--ease)}\n.iconbtn:hover{background:var(--hover)}\n.iconbtn:active{background:var(--press)}\n.iconbtn.bd{border-color:var(--line)}\n.chip{display:inline-flex;align-items:center;gap:5px;border-radius:var(--r-pill);padding:2px 9px;font-size:var(--t-xs);font-weight:600;white-space:nowrap;line-height:1.4}\n.count{font-size:var(--t-xs);font-weight:600;color:var(--ink2);background:var(--panel);border:1px solid var(--line-2);border-radius:var(--r-pill);padding:1px 8px}\n.dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none}\n.meta{color:var(--muted);font-size:var(--t-xs);font-weight:500}\n.gap{color:var(--amberink);font-weight:600}\n.gapchip{display:inline-flex;align-items:center;gap:4px;border-radius:var(--r-pill);padding:1px 8px;font-size:11px;font-weight:600;background:oklch(0.6 0.14 65 / .14);color:var(--amberink);white-space:nowrap}\n.input{border:1px solid var(--line);border-radius:var(--r-ctl);padding:0 12px;height:40px;font-size:var(--t-sm);background:var(--bg);width:100%;color:var(--ink);outline:none;transition:border-color var(--fast) var(--ease),box-shadow var(--fast) var(--ease)}\n.input:focus,.input.focus{border-color:oklch(0.6 0.15 255 / .6);box-shadow:0 0 0 3px oklch(0.6 0.15 255 / .12)}\n.input[disabled]{background:var(--panel);color:var(--muted)}\nselect.input{-webkit-appearance:none;appearance:none;padding-right:34px;background:var(--bg) url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2352525b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\") no-repeat right 11px center/16px;cursor:pointer}\ntextarea.input{height:auto;min-height:84px;padding:10px 12px;resize:vertical;line-height:1.5}\n.input.warn{border-color:oklch(0.6 0.14 65 / .7);box-shadow:0 0 0 3px oklch(0.6 0.14 65 / .14)}\n.input.warn::placeholder{color:var(--amberink);font-weight:600}\nselect.input.warn{color:var(--amberink);font-weight:600}\n.field label,.flabel{display:block;font-size:var(--t-xs);font-weight:600;color:var(--ink);margin-bottom:5px}\n.field label em{font-style:normal;font-weight:500;color:var(--muted)}\n.hint{font-size:var(--t-xs);font-weight:500;color:var(--muted);margin-top:5px;display:flex;gap:5px;align-items:center}\n.hint:empty{display:none}\n.hint.bad{color:var(--redink)} .hint.warn{color:var(--amberink)} .hint.good{color:var(--greenink)}\n.switch{position:relative;width:44px;height:26px;flex:none;display:inline-block;border:0;padding:0;background:none}\n.switch i{position:absolute;inset:0;border-radius:var(--r-pill);background:oklch(0.82 0.005 285);transition:background var(--med) var(--ease)}\n.switch i::after{content:\"\";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgb(0 0 0 / .2);transition:left var(--med) var(--ease)}\n.switch.on i{background:var(--primary)} .switch.on i::after{left:21px}\n.switch[disabled]{opacity:.5}\n.seg{display:inline-flex;background:var(--panel);border:1px solid var(--line-2);border-radius:12px;padding:3px}\n.seg button{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;background:none;border-radius:9px;height:32px;padding:0 14px;font-size:var(--t-sm);font-weight:500;color:var(--ink2)}\n.seg button.on{background:var(--bg);color:var(--ink);font-weight:600;box-shadow:0 0 0 1px var(--line)}\n.av{width:36px;height:36px;border-radius:50%;display:inline-grid;place-items:center;font-size:12px;font-weight:600;color:#fff;flex:none}\n.av.sm{width:28px;height:28px;font-size:11px}\n.frost{background:rgb(255 255 255 / .94);backdrop-filter:blur(22px) saturate(1.5);-webkit-backdrop-filter:blur(22px) saturate(1.5);border:1px solid var(--line);box-shadow:0 12px 40px rgb(0 0 0 / .12)}\n.scrim{position:fixed;inset:0;background:rgb(20 20 25 / .2);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);z-index:90;display:flex;align-items:center;justify-content:center;padding:16px}\n.scrim.top{align-items:flex-start;padding-top:12vh}\n.scrim.side{justify-content:flex-end;align-items:stretch;padding:0}\n.scrim.bottom{align-items:flex-end;padding:0}\n.modal{border-radius:20px;padding:24px;width:540px;max-width:100%;max-height:92dvh;overflow:auto}\n.modal.narrow{width:440px}\n.modal h2{font-size:20px;font-weight:650}\n.lede{font-size:var(--t-sm);margin:4px 0 18px}\n.mfoot{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}\n.sheet{width:100%;border-radius:20px 20px 0 0;padding:20px 18px calc(28px + var(--safe-b));max-height:92dvh;overflow:auto}\n.toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,10px);background:var(--primary);color:#fff;border-radius:12px;padding:0 16px;min-height:44px;max-width:calc(100vw - 32px);font-size:var(--t-sm);font-weight:500;display:flex;align-items:center;gap:8px;z-index:120;opacity:0;pointer-events:none;transition:opacity var(--med) var(--ease),transform var(--med) var(--ease)}\n.toast.show{opacity:1;transform:translate(-50%,0)}\n.toast.bad{background:oklch(0.96 0.03 65);color:var(--ink);border:1px solid oklch(0.6 0.14 65 / .45)}\n.toast.bad svg{color:var(--amberink)}\n.fgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}\n.fgrid .full{grid-column:1 / -1}\n@keyframes spin{to{transform:rotate(360deg)}}\n.spin{width:14px;height:14px;border-radius:50%;border:2px solid oklch(0.85 0.005 285);border-top-color:var(--ink);display:inline-block;animation:spin .8s linear infinite;flex:none}\n\n/* ===================== App shell (same as the onboarding hub) ===================== */\n.app{--sw:232px;display:grid;grid-template-columns:var(--sw) minmax(0,1fr);height:100dvh;transition:grid-template-columns var(--slow) var(--ease)}\n.side{border-right:1px solid var(--line);background:var(--bg);display:flex;flex-direction:column;padding:20px 12px 14px;overflow-y:auto;min-height:0}\n.brand{display:flex;align-items:center;gap:10px;padding:0 8px}\n.brand img{width:34px;height:34px;flex:none}\n.brand b{flex:1;min-width:0;font-size:var(--t-md);font-weight:650;color:var(--ink);white-space:nowrap;overflow:hidden;letter-spacing:-.2px}\n.sidetog{margin-right:-6px}\n.sidetog .chv{transition:transform var(--med) var(--ease);transform-origin:14.5px 12px}\n.jump{display:flex;align-items:center;gap:10px;margin:18px 0 6px;width:100%;height:40px;padding:0 10px;border-radius:var(--r-ctl);border:1px solid var(--line);background:var(--bg);color:var(--ink2);font-size:var(--t-sm);transition:background var(--fast) var(--ease)}\n.jump:hover{background:var(--hover)}\n.jump span{flex:1;text-align:left}\nkbd{font:600 11px/1 Inter,sans-serif;color:var(--ink2);background:#fff;border:1px solid var(--line);border-bottom-width:2px;border-radius:5px;padding:3px 5px}\n.navgroup{margin-top:16px}\n.navgroup h4{font-size:var(--t-xs);font-weight:600;color:var(--muted);padding:0 12px 4px}\n.nav button{position:relative;display:flex;align-items:center;gap:11px;width:100%;border:1px solid transparent;background:none;height:40px;padding:0 12px;border-radius:10px;color:var(--ink2);font-size:var(--t-base);font-weight:500;text-align:left;transition:background var(--fast) var(--ease)}\n.nav button:hover{background:var(--hover)}\n.nav button:active{background:var(--press)}\n.nav button.active{border-color:rgb(0 0 0 / .1);background:rgb(0 0 0 / .045);color:var(--ink);font-weight:600}\n.nav button.active::before{content:\"\";position:absolute;left:-12px;top:9px;bottom:9px;width:3px;border-radius:0 3px 3px 0;background:var(--gold)}\n.nav button.active svg.i{stroke-width:2.1}\n.side .spacer{flex:1;min-height:16px}\n.side .foot{border-top:1px solid var(--line-2);padding-top:10px}\n.me{display:flex;align-items:center;gap:10px;padding:12px 12px 0;font-size:var(--t-sm);color:var(--ink);font-weight:500}\n.me small{display:block;color:var(--muted);font-size:var(--t-xs);font-weight:400}\n/* collapsed sidebar: icon rail */\n.crm.sb-collapsed .app{--sw:68px}\n.crm.sb-collapsed .side{padding-left:10px;padding-right:10px}\n.crm.sb-collapsed .side .brand{flex-direction:column;gap:12px;padding:0}\n.crm.sb-collapsed .side .brand b,.crm.sb-collapsed .side .nl,.crm.sb-collapsed .side kbd,.crm.sb-collapsed .navgroup h4{display:none}\n.crm.sb-collapsed .sidetog{margin:0}\n.crm.sb-collapsed .sidetog .chv{transform:scaleX(-1)}\n.crm.sb-collapsed .jump{justify-content:center;padding:0}\n.crm.sb-collapsed .nav button{justify-content:center;padding:0;gap:0}\n.crm.sb-collapsed .nav button.active::before{left:-10px}\n.crm.sb-collapsed .navgroup{margin-top:10px;padding-top:10px;border-top:1px solid var(--line-2)}\n.crm.sb-collapsed .navgroup:first-child{border-top:0;padding-top:0}\n.crm.sb-collapsed .me{justify-content:center;padding:12px 0 0}\n\n.main{min-width:0;display:flex;flex-direction:column;height:100dvh;overflow:hidden}\n.mtop{display:none}\n.head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:26px 32px 0;flex-wrap:wrap}\n.head .date{color:var(--muted);font-size:var(--t-sm);font-weight:500}\n.head h1{font-size:var(--t-lg);font-weight:700;letter-spacing:-.4px;line-height:1.25}\n.headacts{display:flex;gap:8px;align-items:center}\n.aipill{display:inline-flex;align-items:center;gap:7px;height:40px;padding:0 12px;border-radius:var(--r-ctl);border:1px solid var(--line);background:var(--bg);font-size:var(--t-sm);font-weight:500;color:var(--ink2);white-space:nowrap}\n.aipill:hover{background:var(--hover)}\n.subnav{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 32px 0}\n.content{flex:1;min-height:0;padding:16px 32px 28px;overflow-y:auto}\n.content.leadmode{overflow:hidden}\n\n/* ===================== Inbox ===================== */\n.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));padding:6px;gap:6px;margin-bottom:14px}\n.stat{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:10px;min-width:0}\n.stat+.stat{box-shadow:-7px 0 0 -6px var(--line)}\n.stat .ic{width:34px;height:34px;border-radius:50%;background:var(--panel);display:grid;place-items:center;color:var(--ink2);flex:none}\n.stat b{display:block;font-size:20px;font-weight:650;color:var(--ink);line-height:1.15}\n.stat span.l{font-size:var(--t-xs);font-weight:500;color:var(--muted)}\n.filters{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}\n.search{position:relative;flex:1 1 280px;max-width:420px;min-width:0}\n.search svg{position:absolute;left:12px;top:12px;color:var(--muted);pointer-events:none}\n.search .input{padding-left:38px}\n.search .input::-webkit-search-cancel-button{-webkit-appearance:none}\n.fsel{position:relative;display:inline-flex}\n.fsel .input{height:36px;font-size:var(--t-sm);width:auto;min-width:0}\n.fsel.on .input,.ftog.on,.filtbtn.on{background-color:oklch(0.6 0.11 185 / .1);border-color:oklch(0.6 0.11 185 / .55);box-shadow:inset 0 -2px 0 var(--teal);color:var(--ink);font-weight:600}\n.ftog{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 12px;border:1px solid var(--line);border-radius:var(--r-ctl);background:var(--bg);font-size:var(--t-sm);font-weight:500;color:var(--ink2);white-space:nowrap}\n.ftog .switch{transform:scale(.75);margin:0 -5px}\n.ftog.on .switch i{background:var(--teal)}\n.filtbtn{display:none;height:36px}\n.chipseg{display:inline-flex;gap:4px}\n.chipseg button{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border-radius:var(--r-ctl);border:1px solid var(--line);background:var(--bg);font-size:var(--t-sm);font-weight:500;color:var(--ink2);white-space:nowrap}\n.chipseg button.on{background:var(--primary);color:#fff;border-color:transparent;font-weight:600}\n.chipseg button.on .count{background:rgb(255 255 255 / .18);color:#fff;border-color:transparent}\n.clear{border:0;background:none;padding:0 4px;color:var(--tealink);font-size:var(--t-sm);font-weight:600;text-decoration:underline;text-underline-offset:2px;white-space:nowrap}\n.listhead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:2px 0 8px;font-size:var(--t-sm);color:var(--ink2)}\n.listhead b{color:var(--ink)}\n.lhr{display:flex;gap:10px;align-items:center}\n.refreshing{display:inline-flex;align-items:center;gap:6px;color:var(--ink2);font-size:var(--t-xs);font-weight:600}\n.tablebox{overflow-x:auto}\ntable{width:100%;border-collapse:collapse}\nth{background:var(--panel);text-align:left;font-size:var(--t-xs);font-weight:600;color:var(--muted);padding:9px 12px;border-bottom:1px solid var(--line-2);white-space:nowrap}\ntd{padding:11px 12px;border-bottom:1px solid var(--line-2);vertical-align:middle;font-size:var(--t-sm)}\ntbody tr{cursor:pointer;transition:background var(--fast) var(--ease)}\ntbody tr:hover td{background:rgb(0 0 0 / .02)}\ntr:last-child td{border-bottom:0}\ntr.sel td{background:oklch(0.975 0.003 95)}\ntd.c-lead{width:38%;max-width:0}\n.lead{display:flex;gap:11px;align-items:flex-start;min-width:0}\n.lead .t{min-width:0;flex:1}\n.lead .nm{display:flex;align-items:center;gap:7px;font-weight:600;color:var(--ink);font-size:var(--t-base);min-width:0}\n.lead .nm span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.lead .sub{display:block;color:var(--ink2);font-size:var(--t-sm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.lead .subx{display:none;color:var(--muted);font-size:var(--t-xs);font-weight:500;margin-top:2px}\n.reasons{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px}\n.unread{width:8px;height:8px;border-radius:50%;background:var(--blue);flex:none;display:inline-block}\n.reason{display:inline-flex;align-items:center;gap:4px;border-radius:var(--r-pill);padding:1px 8px;font-size:11px;font-weight:600;white-space:nowrap}\n.aim{display:inline-flex;align-items:center;gap:5px;font-size:var(--t-xs);font-weight:600;color:var(--ink2);white-space:nowrap}\n.time{font-size:var(--t-xs);font-weight:500;color:var(--muted);white-space:nowrap}\n.lnk{border:0;background:none;padding:0;color:var(--tealink);font-weight:600;text-decoration:none;font-size:var(--t-sm);text-align:left;cursor:pointer}\n.lnk:hover{text-decoration:underline;text-underline-offset:2px}\n.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;padding:56px 24px;color:var(--ink2)}\n.empty .eic{width:52px;height:52px;border-radius:50%;background:var(--panel);display:grid;place-items:center;color:var(--ink2);margin-bottom:6px}\n.empty b{font-size:var(--t-md);color:var(--ink)}\n.mcards{display:none}\n\n/* compact list (when a lead is open) */\n.split{display:grid;grid-template-columns:400px minmax(0,1fr);gap:16px;height:100%;min-height:0}\n.listcol{display:flex;flex-direction:column;min-height:0}\n.listcol .filters{flex-wrap:nowrap}\n.listcol .search{max-width:none}\n.clist{display:flex;flex-direction:column;overflow-y:auto;min-height:0;flex:1}\n.crow{display:flex;gap:11px;padding:11px 12px;border-bottom:1px solid var(--line-2);position:relative;cursor:pointer;flex:none;background:none;border-left:0;border-right:0;border-top:0;text-align:left;width:100%}\n.crow:hover{background:rgb(0 0 0 / .02)}\n.crow.sel{background:oklch(0.975 0.003 95)}\n.crow.sel::before{content:\"\";position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:0 3px 3px 0;background:var(--ink)}\n.crow .t{flex:1;min-width:0}\n.crow .l1{display:flex;align-items:center;gap:6px}\n.crow .l1 b{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink);font-weight:600}\n.crow .sub{display:block;font-size:var(--t-sm);color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.crow .l3{display:flex;align-items:center;gap:6px;margin-top:5px;flex-wrap:wrap}\n\n/* ===================== Lead panel ===================== */\n.lpanel{display:grid;grid-template-columns:minmax(0,1fr) 352px;grid-template-rows:auto minmax(0,1fr);height:100%;min-height:0;overflow:hidden}\n.lph{grid-column:1 / -1;display:flex;align-items:center;gap:12px;padding:12px 14px 12px 16px;border-bottom:1px solid var(--line-2);min-width:0}\n.lph .t{flex:1;min-width:0}\n.lph .t b{display:block;font-size:var(--t-md);color:var(--ink);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.lph .t>span{display:flex;gap:10px;align-items:center;font-size:var(--t-xs);flex-wrap:wrap}\n.lph .back{display:none}\n.plseg{display:none;grid-column:1 / -1;padding:8px 12px;border-bottom:1px solid var(--line-2)}\n.pseg{display:grid;grid-template-columns:repeat(3,1fr);background:var(--panel);border-radius:12px;padding:3px}\n.pseg.two{grid-template-columns:1fr 1fr}\n.pseg button{display:flex;align-items:center;justify-content:center;height:36px;border:0;background:none;border-radius:9px;font-size:var(--t-sm);font-weight:500;color:var(--ink2)}\n.pseg button.on{background:#fff;color:var(--ink);font-weight:600;box-shadow:0 0 0 1px var(--line)}\n.thread{display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--line-2)}\n.msgs{flex:1;min-height:0;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:4px}\n.msgs>:first-child{margin-top:auto}\n.daysep{align-self:center;font-size:11px;font-weight:600;color:var(--muted);margin:4px 0 8px}\n.bub{max-width:82%;padding:9px 13px;border-radius:16px;font-size:var(--t-sm);line-height:1.45;color:var(--ink);white-space:pre-wrap;overflow-wrap:anywhere}\n.bub.out{align-self:flex-end;background:oklch(0.94 0.004 285);border-bottom-right-radius:6px}\n.bub.in{align-self:flex-start;background:#fff;border:1px solid var(--line);border-bottom-left-radius:6px}\n.bmeta{font-size:11px;font-weight:500;color:var(--muted);margin:2px 4px 10px;display:inline-flex;align-items:center;gap:5px}\n.bmeta.r{align-self:flex-end} .bmeta.l{align-self:flex-start}\n.draft{margin:0 16px 10px;border-radius:14px;border:1.5px dashed oklch(0.6 0.14 65 / .55);background:oklch(0.6 0.14 65 / .06);padding:12px 14px;flex:none}\n.draft .dh{display:flex;align-items:center;gap:8px;font-size:var(--t-xs);font-weight:600;color:var(--amberink);margin-bottom:6px}\n.draft .dh .meta{margin-left:auto}\n.draft p{margin:0 0 10px;font-size:var(--t-sm);color:var(--ink);white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow-y:auto}\n.draft textarea.input{margin-bottom:10px;min-height:96px}\n.draft .da{display:flex;gap:6px;flex-wrap:wrap}\n.fup{display:flex;align-items:center;gap:10px;margin:0 16px 10px;padding:10px 12px;border-radius:12px;background:var(--panel);font-size:var(--t-sm);color:var(--ink);flex:none;flex-wrap:wrap}\n.fup span{flex:1;min-width:140px}\n.composer{display:flex;gap:8px;align-items:flex-end;padding:10px 16px 14px;border-top:1px solid var(--line-2);flex:none}\n.composer .input{min-height:44px;height:44px;max-height:180px;border-radius:22px;padding:11px 16px;resize:none;overflow-y:auto}\n.sendbtn{width:44px;height:44px;border-radius:50%;background:var(--primary);color:#fff;border:0;display:grid;place-items:center;flex:none}\n.sendbtn.off{background:oklch(0.85 0.005 285);pointer-events:none}\n.firsttext{margin:auto;max-width:340px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px}\n.firsttext .btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:4px}\n.details{overflow-y:auto;min-height:0;padding:14px 16px 20px;display:flex;flex-direction:column;gap:12px;background:#fff}\n.dsec{border:1px solid var(--line);border-radius:14px;padding:12px 14px;flex:none}\n.dsec h5{font-size:var(--t-xs);font-weight:600;color:var(--ink2);margin:0 0 8px;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:32px}\n.dsec.hl{background:var(--panel);border-color:transparent}\n.kv{display:grid;grid-template-columns:110px minmax(0,1fr);gap:7px 10px;font-size:var(--t-sm);margin:0}\n.kv dt{color:var(--muted);font-weight:500}\n.kv dd{margin:0;color:var(--ink);font-weight:500;min-width:0;overflow-wrap:anywhere}\n.phv{display:flex;align-items:center;gap:2px;flex-wrap:wrap}\n.phv .iconbtn{width:28px;height:28px}\n.phedit{display:flex;gap:6px;flex-wrap:wrap}\n.phedit .input{flex:1 1 140px;height:36px}\n.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}\n.two .full{grid-column:1 / -1}\n.aiseg{display:grid;grid-template-columns:1fr 1fr;background:var(--panel);border-radius:10px;padding:3px}\n.aiseg.three{grid-template-columns:repeat(3,1fr)}\n.aiseg button{display:flex;align-items:center;justify-content:center;height:32px;border:0;background:none;border-radius:8px;font-size:var(--t-sm);font-weight:500;color:var(--ink2)}\n.aiseg button.on{background:#fff;color:var(--ink);font-weight:600;box-shadow:0 0 0 1px var(--line)}\n.aiexp{font-size:var(--t-xs);color:var(--ink2);margin-top:6px}\n.setrow{display:flex;align-items:center;gap:12px;justify-content:space-between}\n.setrow b{display:block;color:var(--ink);font-weight:600}\n.steps{list-style:none;margin:0;padding:0}\n.steps li{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--line-2);font-size:var(--t-sm);color:var(--ink);flex-wrap:wrap}\n.steps li:last-child{border-bottom:0}\n.steps li>span:nth-child(2){flex:1;min-width:120px}\n.steps li.done>span:nth-child(2){color:var(--muted);text-decoration:line-through}\n.cbx{width:18px;height:18px;border-radius:6px;border:1.5px solid rgb(0 0 0 / .28);flex:none;display:grid;place-items:center}\n.cbx.on{background:var(--primary);border-color:transparent;color:#fff}\n.warnbox{display:flex;gap:8px;align-items:flex-start;padding:9px 11px;border-radius:10px;background:oklch(0.6 0.14 65 / .12);color:var(--ink);font-size:var(--t-sm);margin-top:8px;text-align:left}\n.warnbox svg{color:var(--amberink);margin-top:2px}\n.warnbox b{color:var(--amberink)}\n.okbox{display:flex;gap:8px;align-items:center;padding:9px 11px;border-radius:10px;background:oklch(0.6 0.13 155 / .1);font-size:var(--t-sm);color:var(--ink);margin-top:8px}\n.okbox svg{color:var(--greenink)}\n.menu{position:fixed;z-index:95;width:250px;border-radius:14px;padding:6px}\n.menu button{display:flex;align-items:center;gap:10px;width:100%;height:40px;padding:0 10px;border:0;background:none;border-radius:9px;font-size:var(--t-sm);font-weight:500;color:var(--ink);text-align:left}\n.menu button:hover{background:var(--press)}\n.menu button.dng{color:var(--redink)}\n.menu hr{border:0;border-top:1px solid var(--line-2);margin:4px 6px}\n\n/* ===================== Knowledge + Settings ===================== */\n.kaddgrid{display:grid;grid-template-columns:1fr 1.4fr;gap:14px}\n.drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:1.5px dashed rgb(0 0 0 / .2);border-radius:12px;min-height:150px;font-weight:600;color:var(--ink);cursor:pointer;text-align:center;padding:12px;transition:background var(--fast) var(--ease)}\n.drop:hover{background:var(--hover)}\n.drop.busy{opacity:.6;pointer-events:none}\n.kpaste{display:flex;flex-direction:column;gap:8px}\n.kpaste textarea.input{min-height:74px}\n.kphone{display:none;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}\n.krow{display:grid;grid-template-columns:36px minmax(0,1fr) 190px 120px 40px;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line-2)}\n.krow:last-child{border-bottom:0}\n.kic{width:36px;height:36px;border-radius:10px;background:var(--panel);display:grid;place-items:center;color:var(--ink2)}\n.kmain{border:0;background:none;padding:0;text-align:left;min-width:0;cursor:pointer}\n.kmain b{display:block;color:var(--ink);font-weight:600;font-size:var(--t-sm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.kmain .meta{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.kst{display:inline-flex;align-items:center;gap:7px;font-size:var(--t-xs);font-weight:600;border:0;background:none;padding:0;text-align:left}\n.kst.ok{color:var(--greenink);cursor:pointer}\n.kst.bad{color:var(--redink)}\n.kst.wait{color:var(--ink2)}\n.kst .btn{height:26px}\n.kact{display:flex;align-items:center;gap:8px;font-size:var(--t-xs);font-weight:500}\n.cardhead{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line-2);flex-wrap:wrap}\n.cardhead h3{font-size:var(--t-md);font-weight:600;display:flex;align-items:center;gap:8px}\n.cardbody{padding:14px 16px}\n.setgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}\n.setcol{display:flex;flex-direction:column;gap:16px;min-width:0}\n.ptable{width:100%;border:1px solid var(--line-2);border-radius:12px;overflow:hidden;font-size:var(--t-sm);margin:0}\n.ptable div{display:grid;grid-template-columns:120px minmax(0,1fr);gap:10px;padding:8px 12px;border-bottom:1px solid var(--line-2)}\n.ptable div:last-child{border-bottom:0}\n.ptable dt{color:var(--muted);font-weight:500}\n.ptable dd{margin:0;color:var(--ink);font-weight:500;overflow-wrap:anywhere}\n.people{list-style:none;margin:0;padding:0}\n.people li{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line-2);font-size:var(--t-sm);flex-wrap:wrap}\n.people li:last-child{border-bottom:0}\n.people li .t{flex:1;min-width:0}\n.people li .t b{display:block;color:var(--ink);font-weight:600;overflow-wrap:anywhere}\n.addrow{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;margin-top:10px}\n.code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:var(--t-sm);font-weight:600;color:var(--ink);letter-spacing:.5px;margin-right:10px}\n.pastebox{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.55;color:var(--ink2);white-space:pre-wrap}\n.editor{width:560px;max-width:100%;padding:24px;border-radius:20px 0 0 20px;display:flex;flex-direction:column;gap:12px;overflow:auto}\n.editor .edhead{display:flex;align-items:center;justify-content:space-between}\n.editor .edhead h2{font-size:20px;font-weight:650}\n.editor textarea.input{min-height:360px;flex:1}\n.editor .mfoot{margin-top:4px}\n\n/* ===================== Ctrl+K ===================== */\n.cmdk{width:600px;max-width:100%;border-radius:18px;overflow:hidden}\n.cmdq{display:flex;align-items:center;gap:10px;padding:0 16px;border-bottom:1px solid var(--line-2);height:54px}\n.cmdq input{flex:1;min-width:0;border:0;outline:none;background:none;font-size:var(--t-md);color:var(--ink)}\n.cmdres{padding:8px;max-height:60vh;overflow-y:auto}\n.cmdres .grp{padding:8px 10px 4px}\n.cmdres .it{display:flex;align-items:center;gap:12px;width:100%;min-height:46px;padding:0 10px;border:0;background:none;border-radius:10px;text-align:left;color:var(--ink);font-weight:500}\n.cmdres .it.act{background:var(--press)}\n.cmdres .it .meta{margin-left:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:55%}\n\n/* ===================== Phone chrome ===================== */\n.bottomnav,.fab{display:none}\n\n/* ===================== Breakpoints =====================\n   1240 and up: full table, compact list + panel with thread and details side by side, two-column settings.\n   900 to 1239: table folds Plan and Contract into the lead subtitle; the panel takes the main area with Chat and Details tabs.\n   768 to 899: sidebar is an icon rail; filters move into a Filters button and sheet; knowledge add area stacks.\n   Below 768: phone layout with bottom nav, + Lead button, cards instead of rows, sheets for forms. */\n@media (max-width:1239px){\n  th.c-plan,th.c-contract,td.c-plan,td.c-contract{display:none}\n  .lead .subx{display:block}\n  .split{grid-template-columns:minmax(0,1fr)}\n  .listcol{display:none}\n  .lpanel{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr)}\n  .plseg{display:block}\n  .lpanel.t-chat .details{display:none}\n  .lpanel.t-details .thread{display:none}\n  .thread{border-right:0}\n  .lph .back{display:inline-grid}\n  .lph .closex{display:none}\n  .details{padding:14px 16px 24px}\n  .setgrid{grid-template-columns:minmax(0,1fr)}\n  .head{padding:24px 24px 0}\n  .subnav{padding:16px 24px 0}\n  .content{padding:16px 24px 28px}\n}\n@media (max-width:899px){\n  .app{--sw:68px}\n  .side{padding-left:10px;padding-right:10px}\n  .side .brand{flex-direction:column;gap:12px;padding:0}\n  .side .brand b,.side .nl,.side kbd,.navgroup h4,.sidetog{display:none}\n  .jump{justify-content:center;padding:0}\n  .nav button{justify-content:center;padding:0;gap:0}\n  .nav button.active::before{left:-10px}\n  .navgroup{margin-top:10px;padding-top:10px;border-top:1px solid var(--line-2)}\n  .navgroup:first-child{border-top:0;padding-top:0}\n  .me{justify-content:center;padding:12px 0 0}\n  .filters .fsel,.filters .ftog,.filters .clear{display:none}\n  .filtbtn{display:inline-flex}\n  .kaddgrid{grid-template-columns:1fr}\n  .krow{grid-template-columns:36px minmax(0,1fr) auto 40px}\n  .krow .kst{grid-column:2 / 3;grid-row:2}\n  .krow .kact{grid-column:3 / 4}\n}\n@media (max-width:767px){\n  .app{display:block;height:auto}\n  .side{display:none}\n  .main{height:auto;overflow:visible}\n  .mtop{display:flex;align-items:center;justify-content:space-between;gap:8px;height:calc(52px + var(--safe-t));padding:var(--safe-t) 12px 0 16px;position:sticky;top:0;background:rgb(255 255 255 / .96);border-bottom:1px solid var(--line-2);z-index:30}\n  .mtop .brand{padding:0}\n  .mtop .brand img{width:30px;height:30px}\n  .mtop .iconbtn{width:44px;height:44px}\n  .head{padding:12px 16px 0;align-items:center;flex-wrap:nowrap}\n  .head .date{display:none}\n  .head h1{font-size:22px;letter-spacing:-.3px}\n  .head .addbtn{display:none}\n  .aipill{height:34px}\n  .subnav{padding:10px 16px 0}\n  .subnav .seg{display:grid;grid-template-columns:repeat(3,1fr);width:100%;border:0;border-radius:12px}\n  .subnav .seg button{height:36px;padding:0 6px}\n  .subnav .seg svg{display:none}\n  .content{padding:12px 16px calc(150px + var(--safe-b));overflow:visible}\n  .content.leadmode{overflow:visible}\n  .stats{display:none}\n  .filters{gap:6px;margin-bottom:10px}\n  .search{flex:1 1 100%;max-width:none}\n  .listhead{margin-bottom:10px}\n  .listhead .meta{display:none}\n  .listcard{border:0;background:none;border-radius:0}\n  .tablebox{display:none}\n  .mcards{display:block}\n  .mcard{display:block;width:100%;text-align:left;border:1px solid var(--line);border-radius:16px;padding:12px 14px;margin-bottom:10px;background:#fff;cursor:pointer}\n  .mcard .l1{display:flex;align-items:center;gap:7px}\n  .mcard .l1 b{flex:1;min-width:0;color:var(--ink);font-weight:600;font-size:var(--t-base);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n  .mcard .sub{display:block;font-size:var(--t-sm);color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:2px 0 8px}\n  .mcard .chips{display:flex;gap:5px;flex-wrap:wrap;align-items:center}\n  .mcard .ml{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid var(--line-2);font-size:var(--t-xs);font-weight:500}\n  .mcard .ml>span:first-child{display:flex;gap:6px;align-items:center;flex-wrap:wrap;min-width:0}\n  .btn{height:44px}\n  .btn.sm{height:38px}\n  .iconbtn{width:44px;height:44px}\n  .input{height:44px;font-size:16px}\n  .fsel .input{height:44px}\n  .chipseg button,.filtbtn{height:44px}\n  textarea.input{font-size:16px}\n  /* one lead: full screen with Chat and Details tabs */\n  .split{display:block;height:auto}\n  .lpanel{position:fixed;inset:0;z-index:70;border:0;border-radius:0;background:#fff;height:100dvh;padding-top:var(--safe-t)}\n  .lph{height:60px;padding:0 8px;gap:8px}\n  .lph .t b{font-size:var(--t-base)}\n  .lph .t>span .meta,.lph .t>span .chip{display:none}\n  .lph .bd{border-color:transparent}\n  .msgs{padding:12px}\n  .draft,.fup{margin:0 12px 8px}\n  .composer{padding:8px 12px calc(12px + var(--safe-b))}\n  .composer .input{font-size:16px}\n  .details{padding:12px 12px calc(24px + var(--safe-b))}\n  .kv{grid-template-columns:100px minmax(0,1fr)}\n  .two{grid-template-columns:1fr}\n  /* knowledge + settings */\n  .kadd{display:none}\n  .kphone{display:grid}\n  .krow{grid-template-columns:36px minmax(0,1fr) 44px;row-gap:6px;padding:12px}\n  .krow .kst{grid-column:2 / -1;grid-row:auto}\n  .krow .kact{grid-column:2 / -1}\n  .setgrid,.setcol{gap:12px}\n  .addrow{grid-template-columns:1fr}\n  /* forms and sheets */\n  .scrim:not(.top){align-items:flex-end;justify-content:center;padding:0}\n  .modal,.modal.narrow,.editor{width:100%;max-width:none;border-radius:20px 20px 0 0;max-height:94dvh;padding:20px 18px calc(20px + var(--safe-b))}\n  .editor textarea.input{min-height:300px}\n  .modal .mfoot,.editor .mfoot{position:sticky;bottom:calc(-20px - var(--safe-b));margin:16px -18px calc(-20px - var(--safe-b));padding:12px 18px calc(16px + var(--safe-b));background:rgb(255 255 255 / .94);border-top:1px solid var(--line-2)}\n  .modal .mfoot .btn,.editor .mfoot .btn{flex:1;height:48px}\n  .fgrid{grid-template-columns:1fr}\n  .scrim.top{padding:calc(12px + var(--safe-t)) 10px 10px}\n  .toast{bottom:calc(140px + var(--safe-b))}\n  .crm.lead-open .toast{bottom:calc(90px + var(--safe-b))}\n  .bottomnav{display:flex;position:fixed;left:0;right:0;bottom:0;background:rgb(255 255 255 / .96);border-top:1px solid var(--line);z-index:50;padding:4px 6px calc(4px + var(--safe-b))}\n  .bottomnav button{flex:1;border:0;background:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:11px;font-weight:500;color:var(--ink2);min-height:52px;border-radius:12px;min-width:0}\n  .bottomnav button:active{background:var(--press)}\n  .bottomnav button.active{color:var(--ink);font-weight:600;background:rgb(0 0 0 / .045);box-shadow:inset 0 0 0 1px rgb(0 0 0 / .1)}\n  .bottomnav button.active svg.i{stroke-width:2.1}\n  .fab{display:inline-flex;position:fixed;right:16px;bottom:calc(76px + var(--safe-b));z-index:55;height:52px;padding:0 20px;border-radius:var(--r-pill);font-size:var(--t-base);box-shadow:0 6px 20px rgb(0 0 0 / .18)}\n  .crm.lead-open .bottomnav,.crm.lead-open .fab,.crm.no-fab .fab{display:none}\n}\n@media (prefers-reduced-motion:reduce){*{animation:none!important;transition-duration:1ms!important}}\n";

export function mountCrm(root, host) {
'use strict';
/* =========================================================
   Vocabulary from the shared CRM types (passed in by the host)
   ========================================================= */
const V = host.vocab || {};
const STATUS_LABEL = V.STATUS_LABEL || {};
const STATUS_JOURNEY = V.STATUS_JOURNEY || {};
const OFFER_PATH_LABEL = V.OFFER_PATH_LABEL || {};
const LEAD_STATUSES = V.LEAD_STATUSES || Object.keys(STATUS_LABEL);
const OFFER_PATHS = V.OFFER_PATHS || Object.keys(OFFER_PATH_LABEL);
const NEEDS_YOU_LABEL = V.NEEDS_YOU_LABEL || {};
const isBookedThisWeek = V.isBookedThisWeek || (() => false);
const PLAN_OPTIONS = V.PLAN_OPTIONS || [];
const CONTRACT_OPTIONS = V.CONTRACT_OPTIONS || [{ value: '', label: 'Not recorded' }];
const LEAD_SOURCES = V.LEAD_SOURCES || [];
const PROCESS_LABEL = V.PROCESS_LABEL || {};
const PERMIT_LABEL = V.PERMIT_LABEL || {};
const STR_LABEL = V.STR_LABEL || {};
const LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAOXElEQVR42u2dechsZR3HP7+Zea95s1y4lQsIZQUVSqiFLWTbtUVpw5IKRFuEJCXUNpJItCjLpCJMrKtiSSlmtlkSec2l/Z8W6Y80sKwgXNrU3ndmfv1xnsf7cJzzLGfOnHnOzHngct935p0z5zzPb/n+djnwwEOGFGtCv9ZpDQFGzgv7AANAa1xMan4u5Rpi/l/096zqss8thtkfcQlgClwHHA6MDSH0q1tLHSaZ9bs95xHwe+A4YDBy/vhg4KB+H9diPWB/cFXApqGQaS8BVnbZs92cRQDiHHxPAKu7Bq5q6A96zdcoAWD0q5vIP5oAZJ4L9av7EkA9psWpxnQYGiDRL7J28IyBE4CPGpt/OK8K+DXw235vO7UOi1HfsQTweENFo14CkLsTaGTMvL1jVYBGfsHEWA19zCBvF7N19U6TbcJ+zc2FnbIAUvwAvRm4ogQ5WIKp10uczCSARlCMZCoqJbcN7bIE6JoK8IGuRTi1dNUDA9LrRtYyMqQreJD9IUfu4aDBVKte73ZQog0yF589Jy+YSWJVgPQcuboYoOscKQmE2RNyaT9iXcG5i2L1EILMwDlaU8TKgrGKtE2cgzk2owsgaJavQBKeq/z5RTrLbBBnQsuewJzFoiS+rxHc5UqLEHerR3WUJYvOmcQxAfYFjqjI6V84BtCMubvqoDTiYELFEpIgknUBXDgEtszh3wQcb75nmJMrWDIU81WEoB59GiNRJKCLJUFvhw5hwxz+04CfAM/HKdpoOxgkmVoeoRKoRRGaJpRgUTMf83/Ai83hH8Ge0q2lxAK0JZ0+bigRRRuwVqquoQsmSpu29TrgRuAQQwyDZbiC25AAA0PdLwHOMUQgc0bmmkDuREQU1QMcU9PBxDn8U4EbKKqypw3o/IWCQG1IHw2ATwMXGSII1SFKA6AnRcJJ4Po6B+IXpy7vbGBXBrWYEmsGNiUdbLLiWcC3gO2GEEY1I34SQRAacAD59LlWmItSkgwayWhbwIXAZ8xeyAIPP8uEkIHDBa8HbjEIeDMB/IRs8qr3UqwCKYl2n/mokYUaClwJvL9BHFRXmklqShgLqEgaA0cBdxhsYIlAEpG6BBB7U+7ZOvtkbfz9DNg72ZF40qWkUFnATY2MGHwK8CMDijZrgEP1EEaVKgipFG3ATz8yh38ocDNFR45x22ZeaM+WHQwaOrbvLuCCCHAoEVwviRFADXgbfUQmHjPvCOBW4LkZHf5jQKAu2bc/cADiR4BrKMqaqjZMAxzq8++nRPOUsFvaZ+O/ynD+oebZcjv8rFLCxAFLbwZ2UxQ3zgKHUuJqqWH7zw2eSgCxfPgnAt8GDghV566bBNBIcPg8IzpfOgMc6gy9rsTF7WPvRwNmolYQ8CZwBnAthZ9/mvHhPyoBcov1W3B4EPBD4BQPOJRIsZ3K7eKRjOqx8c8HPu8UZg4qGjXR1ZQwWmxyMDVcdHkJHA4TgjcxJmVdZ5Oa/bP3dRlwruPgEU+XrqxUAJnnK1pweC3wBMNpowiOjhXvUrP6yGKWJwLfAd5lfh9WXNOW1/8CuK8F3CWpKiDXhE+70ScaVP30GeBQZmCCEIfrHA4ka+MfYu7p+IDVYoHgVcCru1gb2NaaBMDhkcBtwCtK4DAEAjXCL6AVnC8VZt7hFHH8IyNM1iFFEOxk9iSC5FAvIKkZQbrgmxp6ONP1HN4InOaAw4EHD8SKeKnAFbPMvGPZE8eosvGnzjVPBz7ghIOnXesPoAu8KfvaP4CvOvcxDXgOLzVcNXZ0r69DdpX4j0nsdOP4b6HI3dvfY+Nbff8Q8CbgEmAvc/1prmbgsnMDN4zJ924HLU8C4PAcA8AOqACHvpBwLMG7cfyzgG8EbHxLjPcaVXUDsM283vnKoEWHKHcAX6YInPzVAYA+cHgChefwmRFhZfVk+s7CBq6N/wmKRBafjT922rEfC/zMHP5WF0rD2hjWoBGdyIbAj4EXALc7ANAHDg83f/uaQFhZPPq9LCEGTqHGpcCHA6lsVgLtpkj0vMtIivGSnGzSVUfQxOjLe4wI3eUAQB843AF8zwCuzYrnq0rpKksGK122A980gNMXxx+bw77GEOGD5vdJ7hXFuTqCxo6t/U7DfUOnfKoKHCrwRQp3LB5w6JNC9nt3GLD3Ro/zSR0r4GLgJIrs3lHm/RR1mV3CSBhuIIaTPmnQ9D89uGDgpJ2fAXzfAw59+GATeIYx817ocHeVT38IfNAAxJGTAb1STaKW+RATA6SuN7r1Dx5cIM57x1FEFJ8TmXNo92Kn0ePP9jh43K6pp1Akem4wf41gtlaAZqAStgG/A15EEWsP4YKxOcTbKFy1mx4/vfUX7G3Ux8GOKK8y8+4zxHKlubcJ3etoIl2aGGJF8f0UGcWfcg506gGH+wHfBd5n1IFWgEOM4+Y4ChfvXjOkjJUId1Eksu7O2cZv0hGUSwm5BVwj4EMUiaSPeJxGQ8f7drGxKIYV4NBigD87nD1ywKU9/F8aG//OmoefA9aSVAmwjNRxHzhUs/lXAK80h+ZzGllweCpFksmBHs+hVR+nUAxcGDivX0+RpXSvY+N3ufGVDjra9k0dXHC7Qeu3OIenHnD4MopahCMrwKFrfZwPvN3ggS8ZS+SRDph50X0XcusPoDVxwV+M2L6kNA21Chw+1VgIJ1WAQ2t9bABXA0cD73Eqm6Yr0j5OV6Fd/MTR1acDZwaGW9i/3Q58nSLbqAocWiK4MwA4V6JZtGZwUzIHLsCohC8YXPD3gNPIcvkFhssfV2H3T5zJKrqKbeJWpS2riwtuMf6CnwecRpZA3mo+c5gHF6zsvIA2zUBp0Wl0t0HsV0c6jY424PDYhELVrquA7JNC5w0mbRoUf24gmGQJ5MkUhaqneSKKKysBpKPNn6Ui4ueacx+nyCr+twcXDJ0sn0sNltAaEcWVBoGamQqwHL1VcUhuMOk6wsEkN93svcAPgCclRBTpcrPorkkAe78XGV3vOySLC35jwOGNHlzggsOdBhccFRlRlI6125W2k0KlYeKdAMdQpJCFGky4waTXAp+NCCaNKQpRdgNvC0QU2xy8tbS5gTkCxX+Zh90FfM7J4xsGgklnA+/AH0yyTqN9gK9RxAa2MqzxWzgGaCsaqDWridVw55kUadj7elSCG0y6nCLv8E+RTqPzDKHtVaPjh3a5PFwz9gSqo7e3KLpvuplAg4DT6A6DC24KBJOGTkTRdv7YzFgSSI4JIYuWIBtOmvhthhgmnkOyuOBvBhfEBpOOMUS2s1QC1umEkFVxBI2c1mxnRDSUdGv7bDBpGsAFtvvXhR11EyfHAiRDM1ADjafUOH5ICCZtGAfQToqkj2HFAduQ8H8yTghZiazgeSqWpUZNgHUa3UyRZHKrJ/4/yHz/sjQD2x5CrXMkn94DvJyivi8mD0A6OHep9ergruCMiWPq3RvZEFq7jgHWamJmQmXStlWehtp2MKhrG9nlLCDNsU+g0A+Wzs4RJP0waNZ6drD24+D74dFNzNTpxWyfELKSKkBXWaUNVnRodK+qVqw/QK7EJV0nrkFDs/l6Pd9hR1BXwV8PSHsV0EuUtjuFyhpybdNWgPYTQ/q1tgSgvcjuth9AM9xMyYQ4ZB1AoGSYE9h7AtccA2gmKkC7mkK9jC4ebmmVOm3ctGb61rhU6DlxkjxpID0s5vqScP9j53nFeY0G08y1SQJoCgNs83znjkSJZO9pf6fer/xc+zWwkft6rn9ATYmyw3MW29uUXKOWMICl9Lspiil0xkyfh80/SczZ+wpFfx9Xqtif70zkzFn3fBXwqxK32uvfk8gc9jnPo+hLPGuo5E8b6kamOakAe1h/pGitTs3R8LMO6LIInJOS0q2le76iIXe6vd+HgI81cM+dxABD9tTXzyrA3KpZDygVqsrV0xIYFFn1/kagH8CkYkqZr2BlI8As0xqTTOdWASkX1sQbkhKA8s3mDW1i+fVJgkQpj5HTCjWnpRY0sZusFQRV/r5xCxaPLiIcXIUHpMSFvn4CGlF1JBHULJ6/lcBA6Vnzg6uegTlG00uDAHphKkBrFodqBEhUzyFrwth3jbymzODAWfMCQwQqkc+ac7VQtAqQOcVJefKmeICVeD4rM64xS0f7RHrMZ5rYSPVIEx9BaU19Ps9nFuYJnHXwUlOsV4neKnFf5mL16H7ftbWhTl/iwRVSIX18fQukLYkyaCAA4qNuiRT5saogBo+ox4GlCYetka8JcVggpe9Sa1ladawADWy+BMRV1ec1YfJ3KmFIBGeGDkwj+hHEeE1D6ixW/Gub08NDKkAiNyok9mK7kUlJzGvg0HWG5AqBX/EccJUU9KkFTdzH1hpEaM2L6xyiMeY9iaRo8ZhtEnmode5bEvBC7L2lhJ5lmYUhKaKqirPFo7vncZBoosgmAqeoZ+5wU/kD6iHohSWfjBrs0yMB33rIPJIIkzEW4KkHVEqCStJARFQjTFsCOEMjo67akAVTyw9QtTkxNq5EijCdcW0iCCOGMDWhsVQTOlojcUZdM08bAIm1wsExJp1UeOJCphoeMzIUGwhxYyzXp+b8SeT3auR1NQEXSMQ5tN4fwGcChsy/EDpXz0NrQksXqdEeRiNNVR+jSMBVriwhH3GUABZtKLdfea9hoKV9LQzwX/a0Ye9X3svmVDzcpAQ4imKu3qhmpooGAjepCD0meic13chS817q3K8GME/s3pUlwBbwrBhfR+wIlMt7xuq0SqjED6O+Opi1rkQe9c2h6ItD+7W+azQjYrWKQ5L79dgzfgwGGNXosd+vbgLCUZkABHjQ/BvPaCApCe7GVFMvxlXbRHWyzpEBTaIpRoLbu43noDQe54EyCBTgDSVQqBGpXXgCNhoRXdOEBJNUUNokIdX1NcQSfcpBN5E48iiTuxjg/l5Crp86+D9qbdaBTsRvDgAAAABJRU5ErkJggg==";
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/* ---------------- icons (same line set as the hub) ---------------- */
const I = {
  home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.3c2.1.7 3.5 2.6 3.5 5.7"/>',
  clip:'<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2.5" width="6" height="3" rx="1"/><path d="M9 11h6M9 15h4"/>',
  building:'<rect x="4" y="3" width="11" height="18" rx="1"/><path d="M15 9h5v12h-5"/><path d="M8 7h3M8 11h3M8 15h3"/>',
  team:'<circle cx="12" cy="7" r="3"/><circle cx="5" cy="10" r="2.2"/><circle cx="19" cy="10" r="2.2"/><path d="M6.5 20c0-3.3 2.4-5.5 5.5-5.5s5.5 2.2 5.5 5.5"/><path d="M1.5 19c0-2.3 1.4-3.9 3.5-4.2M22.5 19c0-2.3-1.4-3.9-3.5-4.2"/>',
  brief:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M3 12.5h18"/>',
  chart:'<path d="M4 4v16h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  spark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  search:'<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  chev:'<path d="m6 9 6 6 6-6"/>',
  back:'<path d="m15 6-6 6 6 6"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  check:'<path d="m5 12 5 5 9-10"/>',
  phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  refresh:'<path d="M20 11a8 8 0 0 0-14.9-3.6M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.9 3.6M20 20v-4h-4"/>',
  more:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  up:'<path d="M12 19V5M6 11l6-6 6 6"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  trash:'<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  upload:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  text:'<path d="M5 6h14M5 10h14M5 14h10M5 18h7"/>',
  bell:'<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  key:'<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>',
  out:'<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
  pause:'<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  play:'<path d="M7 5v14l11-7z"/>',
  alert:'<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16h0"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  inbox:'<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/>',
  book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
  sms:'<path d="M4 5h16v11H9l-5 4z"/>',
  rec:'<circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  filter:'<path d="M4 6h16M7 12h10M10 18h4"/>'
};
const ic = (n, c = '') => `<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${I[n] || ''}</svg>`;
const ok = (h, c, L = .6, a) => `oklch(${L} ${c} ${h}${a != null ? ` / ${a}` : ''})`;
const tone = (h, c) => ({ bg: ok(h, c, .6, .15), t: ok(h, c * .9, .45) });
const chip = (txt, h, c) => { const t = tone(h, c); return `<span class="chip" style="background:${t.bg};color:${t.t}">${txt}</span>`; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const errMsg = (e, fb = 'That did not work.') => (e && e.message) ? e.message : fb;

/* ---------------- vocab colours ---------------- */
const STAGE_HUE = { new:[255,.14], engaging:[185,.11], nurturing:[300,.12], interested:[65,.14], booked:[275,.15], call_done:[88,.11], won:[155,.13], low_fit:[270,.02], skip:[270,.02] };
const stageChip = (s) => chip(esc(STATUS_LABEL[s] || s || 'New'), ...(STAGE_HUE[s] || [270, .02]));
const REASON_HUE = { draft_review:[65,.14], review_ai:[65,.14], unanswered_inbound:[255,.14], ai_stuck:[25,.18], kb_miss:[300,.12], high_intent:[155,.13], send_contract:[185,.11] };
const pill = (txt, h, c) => { const x = tone(h, c); return `<span class="reason" style="background:${x.bg};color:${x.t}">${txt}</span>`; };
const reasonChip = (r) => pill(esc(NEEDS_YOU_LABEL[r] || r), ...(REASON_HUE[r] || [270, .02]));
const bookedPill = () => pill('Booked this week', 275, .15);
const AIM = { live: ['AI live', 'var(--green)'], paused: ['AI paused', 'var(--amber)'], off: ['AI off', 'oklch(0.75 0.005 285)'] };
const aim = (k) => `<span class="aim"><i class="dot" style="background:${AIM[k][1]}"></i>${AIM[k][0]}</span>`;
const CONTRACT_HUE = { signed:[155,.13], sent:[65,.14], not_sent:[25,.18] };
const contractLabel = (v) => (CONTRACT_OPTIONS.find((o) => o.value === v) || {}).label || '';
const conChip = (v) => v && CONTRACT_HUE[v] ? chip(esc(contractLabel(v) || v), ...CONTRACT_HUE[v]) : '<span class="gapchip">Not recorded</span>';
const AVC = ['255','300','155','355','65','185','275','25','210'];
const hashIdx = (s) => { let h = 0; for (const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % AVC.length; };
function initials(name) {
  const p = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((p[0] ? p[0][0] : '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
}
const av = (l, cls = '') => `<span class="av ${cls}" style="background:oklch(0.5 0.11 ${AVC[hashIdx(l.id)]})" aria-hidden="true">${esc(initials(l.name))}</span>`;
const firstName = (l) => (String(l.name || '').trim().split(/\s+/)[0]) || 'them';
const onboardingLine = (o) => !o ? '' : o.live ? 'Live' : `${o.stage}, step ${o.step} of ${o.total}`;

/* ---------------- phones ---------------- */
const digitsOf = (p) => String(p || '').replace(/\D/g, '');
function telHref(phone) {
  const d = digitsOf(phone);
  if (d.length < 10) return null;
  const e164 = d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith('1') ? `+${d}` : String(phone).startsWith('+') ? `+${d}` : null;
  return e164 ? `tel:${e164}` : null;
}
/* Company lines (public business line, Twilio sender) are never a client's phone. */
function phoneUsable(phone) {
  const p = String(phone || '').trim();
  if (!p || /^unknown$/i.test(p) || /^n\/?a$/i.test(p)) return false;
  const d = digitsOf(p).replace(/^1(?=\d{10}$)/, '');
  if (d === '6473817325' || d === '2896724026') return false;
  return Boolean(telHref(p));
}
const isTwilioSender = (p) => digitsOf(p).replace(/^1(?=\d{10}$)/, '') === '2896724026';
function fmtPhone(p) {
  const d = digitsOf(p).replace(/^1(?=\d{10}$)/, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(p || '');
}

/* ---------------- time ---------------- */
const DAY = 864e5;
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
const clock = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
function listTime(iso) {
  const d = new Date(iso || 0);
  if (Number.isNaN(d.getTime()) || !iso) return '';
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'Just now';
  const days = Math.round((startOfDay(Date.now()) - startOfDay(d)) / DAY);
  if (days <= 0) return clock(d);
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function dayLabel(iso) {
  const d = new Date(iso);
  const days = Math.round((startOfDay(Date.now()) - startOfDay(d)) / DAY);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
const shortDate = (iso) => { const d = new Date(iso || 0); return Number.isNaN(d.getTime()) || !iso ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
function ago(iso) {
  const diff = Date.now() - new Date(iso || 0).getTime();
  if (!Number.isFinite(diff) || diff < 0 || !iso) return '';
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (diff < DAY) return `${Math.max(1, Math.floor(diff / 3600000))}h ago`;
  return `${Math.max(1, Math.floor(diff / DAY))}d ago`;
}

/* =========================================================
   State: everything shown comes from the host API
   ========================================================= */
const ssGet = (k) => { try { return sessionStorage.getItem(k) || ''; } catch { return ''; } };
const ssSet = (k, v) => { try { if (v) sessionStorage.setItem(k, v); else sessionStorage.removeItem(k); } catch { /* quota */ } };
const lsGet = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* quota */ } };

const S = {
  leads: [], loaded: false, loadErr: '', updatedAt: 0, refreshing: false, total: 0,
  settings: null,
  docs: [], docsLoaded: false, docsErr: '',
  tab: 'contacts', leadId: null, ptab: 'chat',
  f: { q: '', needs: false, path: 'all', stage: 'all', ai: 'all', booked: false, sort: 'inbox' },
  th: { id: null, messages: [], followups: [], draft: null, loaded: false },
  ld: {},
  sms: '',
  draftEdit: null,
  phoneEdit: null,
  busy: {},
  fupDone: {},
  preCall: {},
  callMsg: '',
  modal: null,
  menu: null,
  nl: null,
  ed: { id: null, title: '', text: '', busy: false, err: '', loading: false },
  kUp: { title: '', text: '' },
  set: { op: '', opDirty: false, opMsg: '', nName: '', nPhone: '', nMsg: '', uCode: '', uLabel: '', uMsg: '', paste: '', preview: null, pMsg: '', pErr: '' },
  cmd: { q: '', act: 0, items: [] },
};
if (lsGet('crm-sb') === '1') root.classList.add('sb-collapsed');

function normLead(l) {
  return {
    ...l,
    name: l.name || '',
    notes: l.notes ?? '',
    call_notes: l.call_notes ?? '',
    whats_next: l.whats_next ?? '',
    ai_paused: Boolean(l.ai_paused),
    ai_force_on: Boolean(l.ai_force_on),
    ai_send_mode: l.ai_send_mode === 'draft' ? 'draft' : 'autopilot',
    playbook_steps: Array.isArray(l.playbook_steps) ? l.playbook_steps : [],
    offer_path: l.offer_path || 'unknown',
    unread: Boolean(l.unread),
    needs_you: Array.isArray(l.needs_you) ? l.needs_you : [],
    last_sms: l.last_sms ?? null,
    pending_draft: l.pending_draft ?? null,
  };
}
const leadById = (id) => S.leads.find((l) => String(l.id) === String(id));
function mergeLead(id, patch) {
  const i = S.leads.findIndex((l) => String(l.id) === String(id));
  if (i < 0) { if (patch && patch.id) S.leads.unshift(normLead(patch)); return; }
  const next = { ...S.leads[i] };
  for (const [k, v] of Object.entries(patch || {})) if (v !== undefined) next[k] = v;
  S.leads[i] = normLead(next);
}
function aiEffective() { return S.settings ? S.settings.effective_ai_enabled : true; }
function envKill() { return Boolean(S.settings && S.settings.env_kill_switch); }
function aiState(l) {
  const eff = aiEffective() || l.ai_force_on;
  if (!l.ai_paused && eff) return 'live';
  if (l.ai_paused && eff) return 'paused';
  return 'off';
}
const callbackPhone = () => String((S.settings && S.settings.operator_callback_phone) || '').trim();
function D(l) {
  if (!S.ld[l.id]) S.ld[l.id] = { notes: l.notes || '', callNotes: l.call_notes || '', whatsNext: l.whats_next || '', booked: l.booked_by || '', closed: l.closed_by || '', referred: l.referred_by || '' };
  return S.ld[l.id];
}
const isBusy = (k) => Boolean(S.busy[k]);
function setBusy(k, v) { S.busy[k] = v; renderMain(); }

/* =========================================================
   Shell
   ========================================================= */
const NAV_GROUPS = [
  { title: null, items: [{ id: 'dashboard', label: 'Dashboard', icon: 'home' }] },
  { title: 'Operations', items: [{ id: 'onboarding', label: 'Onboarding', icon: 'clip' }, { id: 'properties', label: 'Properties', icon: 'building' }, { id: 'team', label: 'Team', icon: 'team' }] },
  { title: 'Business', items: [{ id: 'crm', label: 'CRM', icon: 'users' }, { id: 'clients', label: 'Clients', icon: 'brief' }, { id: 'revenue', label: 'Revenue', icon: 'chart' }] },
  { title: 'Assistant', items: [{ id: 'copilot', label: 'Copilot', icon: 'spark' }] },
];
/* OPS hubs use "Settings" for /ops/settings. CRM keeps its own AI/callback settings tab. */
const NAV_FOOT = [{ id: 'settings', label: 'CRM Settings', icon: 'gear' }];
const ALL_NAV = [...NAV_GROUPS.flatMap((g) => g.items), ...NAV_FOOT];
const MOBILE_NAV = ['dashboard', 'crm', 'onboarding', 'team', 'settings'];

root.innerHTML = `<div class="app">
  <aside class="side" aria-label="Main navigation">
    <div class="brand"><img class="logo" src="${LOGO}" alt="" width="34" height="34"><b>Mandel Realty</b><button class="iconbtn sidetog" data-act="sideTog" aria-label="Collapse sidebar" title="Collapse sidebar"><svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9 4v16"/><path class="chv" d="m15.5 10-2 2 2 2"/></svg></button></div>
    <button class="jump" data-cmdk>${ic('search', 'sm')}<span class="nl">Jump to…</span><kbd>${isMac ? '⌘K' : 'Ctrl K'}</kbd></button>
    <div id="nav"></div>
    <div class="spacer"></div>
    <div class="foot nav" id="navFoot"></div>
    <div class="me" title="Admin · Shared account"><span class="av sm" style="background:oklch(0.38 0.02 270)">AD</span><div class="nl">Admin<small>Shared account</small></div></div>
  </aside>
  <main class="main">
    <div class="mtop"><div class="brand"><img class="logo" src="${LOGO}" alt="" width="30" height="30"><b>Mandel Realty</b></div><button class="iconbtn" data-cmdk aria-label="Search leads">${ic('search')}</button></div>
    <header class="head">
      <div><div class="date" id="today"></div><h1>CRM</h1></div>
      <div class="headacts"><button class="aipill" id="aiPill" data-act="goSettings" title="Auto-reply setting"></button><button class="btn primary addbtn cta-add" data-act="newLead">${ic('plus', 'sm plus')}Lead</button></div>
    </header>
    <div class="subnav"><div class="seg" role="tablist" aria-label="CRM sections" id="tabs"></div></div>
    <div class="content" id="content" data-scroll="content"></div>
  </main>
</div>
<button class="btn primary fab cta-add" data-act="newLead">${ic('plus', 'plus')}Lead</button>
<nav class="bottomnav" id="bnav" aria-label="Sections"></nav>
<div id="ov"></div>
<div id="menuHost"></div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>`;

const $ = (s) => root.querySelector(s);
const shadow = root.getRootNode();

let toastT;
function toast(msg, kind) {
  const t = $('#toast');
  t.className = 'toast' + (kind === 'bad' ? ' bad' : '');
  t.innerHTML = (kind === 'bad' ? ic('alert', 'sm') : ic('check', 'sm')) + `<span>${esc(msg)}</span>`;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), kind === 'bad' ? 4200 : 2400);
}

/* Re-rendering keeps the focused field, its caret and every scroll position. */
function keepFocus(fn) {
  const a = shadow.activeElement;
  const k = a && a.dataset ? a.dataset.k : null;
  let s0 = null, s1 = null;
  if (k) { try { s0 = a.selectionStart; s1 = a.selectionEnd; } catch { /* not a text field */ } }
  const scrolls = {};
  root.querySelectorAll('[data-scroll]').forEach((el) => { scrolls[el.dataset.scroll] = el.scrollTop; });
  fn();
  root.querySelectorAll('[data-scroll]').forEach((el) => { if (scrolls[el.dataset.scroll] != null) el.scrollTop = scrolls[el.dataset.scroll]; });
  if (k) {
    const el = root.querySelector(`[data-k="${k}"]`);
    if (el && !el.disabled) { el.focus({ preventScroll: true }); try { if (s0 != null) el.setSelectionRange(s0, s1); } catch { /* select */ } }
  }
}

function renderNav() {
  const active = (id) => id === 'settings' ? S.tab === 'settings' : id === 'crm' ? S.tab !== 'settings' : false;
  const item = (n) => `<button data-nav="${n.id}" title="${n.label}" class="${active(n.id) ? 'active' : ''}" ${active(n.id) ? 'aria-current="page"' : ''}>${ic(n.icon)}<span class="nl">${n.label}</span></button>`;
  $('#nav').innerHTML = NAV_GROUPS.map((g) => `<div class="navgroup nav">${g.title ? `<h4>${g.title}</h4>` : ''}${g.items.map(item).join('')}</div>`).join('');
  $('#navFoot').innerHTML = NAV_FOOT.map(item).join('');
  $('#bnav').innerHTML = MOBILE_NAV.map((id) => { const n = ALL_NAV.find((x) => x.id === id);
    return `<button data-nav="${id}" class="${active(id) ? 'active' : ''}" ${active(id) ? 'aria-current="page"' : ''}>${ic(n.icon)}${n.label}</button>`; }).join('');
}
function renderHead() {
  $('#today').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const on = S.settings ? Boolean(S.settings.ai_responses_enabled) && !envKill() : null;
  $('#aiPill').innerHTML = on == null ? '<i class="dot" style="background:var(--grey)"></i>Auto-reply' : `<i class="dot" style="background:${on ? 'var(--green)' : 'var(--amber)'}"></i>${on ? 'Auto-reply on' : 'Auto-reply off'}`;
  const tabs = [['contacts', 'inbox', 'Contacts'], ['knowledge', 'book', 'Knowledge'], ['settings', 'gear', 'CRM Settings']];
  $('#tabs').innerHTML = tabs.map(([id, i, l]) => `<button role="tab" data-tab="${id}" aria-selected="${S.tab === id}" class="${S.tab === id ? 'on' : ''}">${ic(i, 'sm')}${l}</button>`).join('');
  root.classList.toggle('lead-open', S.tab === 'contacts' && Boolean(S.leadId));
  root.classList.toggle('no-fab', S.tab !== 'contacts');
}

/* =========================================================
   Contacts: inbox
   ========================================================= */
function filtered() {
  const f = S.f;
  const list = S.leads.filter((l) => {
    if (f.path !== 'all' && l.offer_path !== f.path) return false;
    if (f.stage !== 'all' && l.status !== f.stage) return false;
    const live = aiState(l) === 'live';
    if (f.ai === 'live' && !live) return false;
    if (f.ai === 'paused' && live) return false;
    if (f.booked && !isBookedThisWeek(l)) return false;
    if (f.needs && !(l.needs_you.length > 0)) return false;
    return true;
  });
  const t = (l) => new Date(l.last_activity_at || (l.last_sms && l.last_sms.created_at) || l.created_at).getTime() || 0;
  const c = (l) => new Date(l.created_at).getTime() || 0;
  if (f.sort === 'oldest') return list.sort((a, b) => c(a) - c(b));
  if (f.sort === 'newest') return list.sort((a, b) => c(b) - c(a));
  return list.sort((a, b) => t(b) - t(a));
}
const filterCount = () => { const f = S.f; return (f.path !== 'all') + (f.stage !== 'all') + (f.ai !== 'all') + (f.booked ? 1 : 0) + (f.sort !== 'inbox'); };
const filtersActive = () => filterCount() > 0 || S.f.needs || Boolean(S.f.q.trim());
function subLine(l) {
  const m = l.last_sms;
  if (m && m.body) {
    const body = String(m.body).replace(/\s+/g, ' ').trim();
    if (m.direction === 'outbound') return (m.meta && m.meta.ai_generated ? 'AI: ' : 'You: ') + body;
    return body;
  }
  return l.address || STATUS_JOURNEY[l.status] || l.email || 'No messages yet';
}
const reasonsHTML = (l) => { const r = l.needs_you.map(reasonChip); if (isBookedThisWeek(l)) r.push(bookedPill()); return r.join(''); };
const lastIso = (l) => l.last_activity_at || (l.last_sms && l.last_sms.created_at) || l.created_at;
const onbCell = (l) => l.onboarding ? `<button class="lnk" data-act="openUnit" data-id="${esc(l.id)}">${esc(onboardingLine(l.onboarding))} →</button>` : l.status === 'won' ? '<span class="gapchip">Not started</span>' : '<span class="meta">Not sold yet</span>';
const soldish = (l) => l.status === 'won' || l.status === 'call_done';

function tableRow(l) {
  const subx = [l.plan || 'No plan yet', soldish(l) ? (contractLabel(l.contract_status) || 'Contract not recorded') : ''].filter(Boolean).join(' · ');
  return `<tr data-open="${esc(l.id)}" tabindex="0" class="${String(l.id) === String(S.leadId) ? 'sel' : ''}">
   <td class="c-lead"><div class="lead">${av(l)}<div class="t"><span class="nm">${l.unread ? '<i class="unread" title="Unread"></i>' : ''}<span>${esc(l.name || 'Unnamed lead')}</span></span><span class="sub">${esc(subLine(l))}</span><span class="subx">${esc(subx)}</span>${reasonsHTML(l) ? `<div class="reasons">${reasonsHTML(l)}</div>` : ''}</div></div></td>
   <td>${l.source ? esc(l.source) : '<span class="meta">Not set</span>'}</td><td>${stageChip(l.status)}</td>
   <td class="c-plan">${l.plan ? esc(l.plan) : '<span class="meta">None yet</span>'}</td>
   <td class="c-contract">${soldish(l) ? conChip(l.contract_status) : '<span class="meta">None yet</span>'}</td>
   <td>${onbCell(l)}</td>
   <td style="text-align:right"><span class="time">${esc(listTime(lastIso(l)))}</span><br>${aim(aiState(l))}</td>
   <td style="width:44px"><button class="iconbtn" data-act="rowMenu" data-id="${esc(l.id)}" aria-label="Actions for ${esc(l.name)}">${ic('more', 'sm')}</button></td></tr>`;
}
function mcard(l) {
  const right = l.onboarding ? `<button class="lnk" data-act="openUnit" data-id="${esc(l.id)}">${esc(String(onboardingLine(l.onboarding)).split(',')[0])} →</button>` : l.status === 'won' ? '<span class="gapchip">Not started</span>' : aim(aiState(l));
  return `<div class="mcard" data-open="${esc(l.id)}" role="button" tabindex="0"><div class="l1">${av(l, 'sm')}${l.unread ? '<i class="unread" title="Unread"></i>' : ''}<b>${esc(l.name || 'Unnamed lead')}</b><span class="time">${esc(listTime(lastIso(l)))}</span></div>
    <span class="sub">${esc(subLine(l))}</span>
    <div class="chips">${stageChip(l.status)}${reasonsHTML(l)}</div>
    <div class="ml"><span>${esc([l.source || 'No source', l.plan || 'No plan yet'].join(' · '))}${l.status === 'won' ? ' ' + conChip(l.contract_status) : ''}</span><span>${right}</span></div></div>`;
}
function crow(l) {
  return `<button class="crow ${String(l.id) === String(S.leadId) ? 'sel' : ''}" data-open="${esc(l.id)}">${av(l, 'sm')}<span class="t">
    <span class="l1">${l.unread ? '<i class="unread" title="Unread"></i>' : ''}<b>${esc(l.name || 'Unnamed lead')}</b><span class="time">${esc(listTime(lastIso(l)))}</span></span>
    <span class="sub">${esc(subLine(l))}</span>
    <span class="l3">${stageChip(l.status)}${reasonsHTML(l)}${aim(aiState(l))}</span></span></button>`;
}
const opt = (v, label, cur) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(label)}</option>`;
const needsCount = () => S.leads.filter((l) => l.needs_you.length > 0).length;
function chipSeg() {
  return `<div class="chipseg"><button data-act="needs" data-v="0" class="${S.f.needs ? '' : 'on'}">All</button><button data-act="needs" data-v="1" class="${S.f.needs ? 'on' : ''}">Needs you <span class="count">${needsCount()}</span></button></div>`;
}
function filterBar() {
  const f = S.f, n = filterCount();
  return `<div class="filters" role="search">
    <div class="search">${ic('search', 'sm')}<input class="input" type="search" data-k="f.q" value="${esc(f.q)}" placeholder="Search name, phone, email, address or listing" aria-label="Search leads"></div>
    ${chipSeg()}
    <label class="fsel ${f.path !== 'all' ? 'on' : ''}"><select class="input" data-sel="f.path" aria-label="Path">${opt('all', 'All paths', f.path)}${OFFER_PATHS.map((p) => opt(p, OFFER_PATH_LABEL[p] || p, f.path)).join('')}</select></label>
    <label class="fsel ${f.stage !== 'all' ? 'on' : ''}"><select class="input" data-sel="f.stage" aria-label="Stage">${opt('all', 'All stages', f.stage)}${LEAD_STATUSES.map((s) => opt(s, STATUS_LABEL[s] || s, f.stage)).join('')}</select></label>
    <label class="fsel ${f.ai !== 'all' ? 'on' : ''}"><select class="input" data-sel="f.ai" aria-label="AI">${opt('all', 'AI: all', f.ai)}${opt('live', 'AI: live', f.ai)}${opt('paused', 'AI: paused', f.ai)}</select></label>
    <button class="ftog ${f.booked ? 'on' : ''}" data-act="bookedWeek" role="switch" aria-checked="${f.booked}"><span class="switch ${f.booked ? 'on' : ''}"><i></i></span>Booked this week</button>
    <label class="fsel ${f.sort !== 'inbox' ? 'on' : ''}"><select class="input" data-sel="f.sort" aria-label="Sort">${opt('inbox', 'Sort: Inbox', f.sort)}${opt('newest', 'Sort: Newest', f.sort)}${opt('oldest', 'Sort: Oldest', f.sort)}</select></label>
    <button class="btn sm filtbtn ${n ? 'on' : ''}" data-act="filters">${ic('filter', 'xs')}Filters${n ? ` · ${n}` : ''}</button>
    ${filtersActive() ? '<button class="clear" data-act="clearFilters">Clear filters</button>' : ''}
  </div>`;
}
function updatedLabel() {
  if (!S.updatedAt) return '';
  const s = Math.round((Date.now() - S.updatedAt) / 1000);
  return s < 30 ? 'Updated just now' : s < 3600 ? `Updated ${Math.round(s / 60) || 1}m ago` : 'Updated a while ago';
}
const refreshBtn = () => `<button class="iconbtn bd" data-act="refresh" aria-label="Refresh" title="Refresh">${ic('refresh', 'sm')}</button>`;
function listHead(list) {
  const of = list.length !== S.leads.length || S.f.q.trim();
  return `<div class="listhead"><span><b>${list.length} ${list.length === 1 ? 'lead' : 'leads'}</b>${of ? ` <span class="meta">of ${S.f.q.trim() ? S.total || S.leads.length : S.leads.length}</span>` : ''}</span>
   <span class="lhr">${S.refreshing ? '<span class="refreshing"><i class="spin"></i>Refreshing…</span>' : `<span class="meta">${updatedLabel()}</span>`}${refreshBtn()}</span></div>`;
}
const emptyCard = (icon, title, text, action) => `<div class="card"><div class="empty"><span class="eic">${ic(icon)}</span><b>${title}</b>${text ? `<span>${text}</span>` : ''}${action || ''}</div></div>`;
function inboxBody(list) {
  if (!S.loaded && !S.loadErr) return `<div class="card"><div class="empty"><span class="refreshing"><i class="spin"></i>Loading leads…</span></div></div>`;
  if (S.loadErr && !S.leads.length) return emptyCard('alert', 'Leads did not load', esc(S.loadErr), '<button class="btn sm" data-act="refresh" style="margin-top:6px">Try again</button>');
  if (!list.length) {
    const onlyNeeds = S.f.needs && !filterCount() && !S.f.q.trim();
    if (onlyNeeds) return emptyCard('check', 'All caught up', 'No drafts to review, replies or follow-ups right now.', '<button class="clear" data-act="showAll" style="margin-top:6px">Show all leads</button>');
    if (!S.leads.length && !S.f.q.trim()) return emptyCard('users', 'No leads yet', 'Leads from Meta, the website and + Lead show up here.', '');
    return emptyCard('search', 'No leads match these filters', 'Try fewer filters or a different search.', '<button class="clear" data-act="clearFilters" style="margin-top:6px">Clear filters</button>');
  }
  return `<div class="card listcard" style="overflow:hidden"><div class="tablebox"><table><thead><tr><th>Lead</th><th>Source</th><th>Stage</th><th class="c-plan">Plan</th><th class="c-contract">Contract</th><th>Onboarding</th><th style="text-align:right">Last</th><th><span class="sr">Actions</span></th></tr></thead>
   <tbody>${list.map(tableRow).join('')}</tbody></table></div><div class="mcards">${list.map(mcard).join('')}</div></div>`;
}
function inboxView() {
  const list = filtered();
  const unread = S.leads.filter((l) => l.unread).length;
  const bookedWeek = S.leads.filter((l) => isBookedThisWeek(l)).length;
  return `<div class="card stats" aria-label="CRM summary">
    <div class="stat"><span class="ic">${ic('users', 'sm')}</span><div><b>${S.f.q.trim() ? S.total || S.leads.length : S.leads.length}</b><span class="l">Leads</span></div></div>
    <div class="stat"><span class="ic">${ic('sms', 'sm')}</span><div><b>${unread}</b><span class="l">Unread</span></div></div>
    <div class="stat"><span class="ic">${ic('cal', 'sm')}</span><div><b>${bookedWeek}</b><span class="l">Booked this week</span></div></div></div>
    ${filterBar()}${listHead(list)}${inboxBody(list)}`;
}

/* =========================================================
   Contacts: one lead
   ========================================================= */
function aiBtn(l) {
  const st = aiState(l), dis = isBusy('save') || envKill() ? 'disabled' : '';
  if (st === 'live') return `<button class="btn sm" data-act="aiTakeOver" ${dis}>${ic('pause', 'xs')}Take over</button>`;
  if (st === 'paused') return `<button class="btn sm primary" data-act="aiResume" ${dis}>${ic('play', 'xs')}Resume AI</button>`;
  return `<button class="btn sm primary" data-act="aiEnable" ${dis}>${ic('spark', 'xs')}Enable AI</button>`;
}
function leadHeader(l) {
  const ph = phoneUsable(l.phone) ? fmtPhone(l.phone) : 'No phone';
  return `<div class="lph"><button class="iconbtn back" data-act="closeLead" aria-label="Back to contacts">${ic('back')}</button>${av(l)}<div class="t"><b>${esc(l.name || 'Unnamed lead')}</b><span>${aim(aiState(l))}<span class="meta">${esc(ph)}</span>${stageChip(l.status)}</span></div>${aiBtn(l)}<button class="iconbtn bd" data-act="leadMenu" aria-label="More actions">${ic('more', 'sm')}</button><button class="iconbtn closex" data-act="closeLead" aria-label="Close lead">${ic('x', 'sm')}</button></div>`;
}
function msgBy(m) {
  if (m.direction !== 'outbound') return null;
  const meta = m.meta || {};
  if (meta.ai_generated) return 'Sent by AI';
  if (meta.nurture) return 'Nurture';
  return 'You';
}
function canFollowUp() {
  const msgs = S.th.messages;
  const last = msgs[msgs.length - 1];
  return Boolean(last && last.direction === 'outbound' && !S.th.draft && !S.fupDone[last.id || last.created_at]);
}
function thread(l) {
  const first = esc(firstName(l));
  const phoneOk = phoneUsable(l.phone);
  const msgs = S.th.id === l.id ? S.th.messages : [];
  const draft = S.th.id === l.id ? S.th.draft : null;
  const composer = `<div class="composer"><textarea class="input" rows="1" data-k="sms" aria-label="Message" placeholder="${phoneOk ? `Write to ${first} yourself…` : 'Add a phone number to text'}" ${phoneOk ? '' : 'disabled'}>${esc(S.sms)}</textarea><button class="sendbtn ${S.sms.trim() && phoneOk && !isBusy('sms') ? '' : 'off'}" data-act="sendSms" aria-label="Send">${ic('up', 'sm')}</button></div>`;
  if (S.th.id === l.id && !S.th.loaded && !msgs.length) {
    return `<div class="msgs" data-scroll="msgs"><div class="firsttext"><span class="refreshing"><i class="spin"></i>Loading messages…</span></div></div>${composer}`;
  }
  if (!msgs.length && !draft) {
    const mode = l.ai_send_mode === 'draft' ? 'draft' : 'auto';
    const st = aiState(l);
    const dis = !phoneOk || st !== 'live' || envKill() || isBusy('save');
    return `<div class="msgs" data-scroll="msgs"><div class="firsttext"><span class="empty" style="padding:0"><span class="eic">${ic('sms')}</span><b>No messages yet</b></span>
      <span style="font-size:var(--t-sm)">Nothing has gone out to ${first}. Start with an AI text or write your own below.</span>
      <div class="btns"><button class="btn ${mode === 'draft' ? '' : 'primary'}" data-act="aiFirst" ${dis ? 'disabled' : ''}>${ic('spark', 'sm')}${mode === 'draft' ? 'Draft AI first text' : 'Send AI first text'}</button></div>
      <span class="meta">${mode === 'draft' ? 'You review the draft before it sends.' : 'Autopilot sends it right away.'}</span>
      ${phoneOk && st !== 'live' ? `<span class="meta">${st === 'paused' ? 'Resume AI for this chat first.' : 'Enable AI for this chat first.'}</span>` : ''}
      ${!phoneOk ? `<div class="warnbox">${ic('alert', 'sm')}<span><b>No phone number.</b> Add one in Details before texting.</span></div>` : ''}</div></div>${composer}`;
  }
  let lastDay = '';
  const body = msgs.map((m) => {
    const d = dayLabel(m.created_at);
    const sep = d !== lastDay ? `<span class="daysep">${esc(d)}</span>` : '';
    lastDay = d;
    const out = m.direction === 'outbound';
    const by = msgBy(m);
    const t = clock(new Date(m.created_at));
    const metaTxt = out ? `${by} · ${t}` : `${first} · ${t}`;
    return `${sep}<div class="bub ${out ? 'out' : 'in'}">${esc(m.body)}</div><div class="bmeta ${out ? 'r' : 'l'}">${out && m.meta && m.meta.ai_generated ? '<i class="dot" style="background:var(--green);width:6px;height:6px"></i>' : ''}${esc(metaTxt)}</div>`;
  }).join('');
  let draftHTML = '';
  if (draft) {
    const editing = S.draftEdit && S.draftEdit.id === draft.id;
    const steps = l.playbook_steps || [];
    const idx = steps.findIndex((s) => s.status === 'current') + 1;
    const stepBit = idx > 0 ? ` · step ${idx}` : draft.step_title ? ` · ${esc(draft.step_title)}` : '';
    const dis = isBusy('save') ? 'disabled' : '';
    draftHTML = `<div class="draft"><div class="dh">${ic('spark', 'xs')}AI draft · for review${stepBit}<span class="meta">${esc(ago(draft.created_at))}</span></div>
      ${editing ? `<textarea class="input" data-k="draftEdit.text" aria-label="Edit draft">${esc(S.draftEdit.text)}</textarea>` : `<p>${esc(draft.body)}</p>`}
      <div class="da"><button class="btn sm primary" data-act="draftApprove" ${dis}>${ic('check', 'xs')}Approve and send</button>${editing ? `<button class="btn sm" data-act="draftSave" ${dis}>Save</button><button class="btn sm ghost" data-act="draftCancel">Cancel</button>` : `<button class="btn sm" data-act="draftEdit" ${dis}>${ic('edit', 'xs')}Edit</button>`}<button class="btn sm ghost" data-act="draftDiscard" ${dis}>Discard</button></div></div>`;
  }
  const fup = canFollowUp() ? `<div class="fup">${ic('clock', 'sm')}<span>They haven’t replied to the last message.</span><button class="btn sm primary" data-act="followUp" ${isBusy('save') ? 'disabled' : ''}>Follow up</button><button class="btn sm" data-act="fupDone">Done</button></div>` : '';
  return `<div class="msgs" data-scroll="msgs" id="msgs">${body || '<span class="daysep">No messages yet</span>'}</div>${draftHTML}${fup}${composer}`;
}
function aiBlock(l) {
  const st = aiState(l), mode = l.ai_send_mode === 'draft' ? 'draft' : 'autopilot';
  const eff = aiEffective();
  const expl = st === 'live' ? (l.ai_force_on && !eff ? 'AI answers this lead only. Auto-reply is off for everyone else.' : 'AI answers this lead.')
    : st === 'paused' ? 'You took over. AI stays quiet until you resume.' : `AI is off for this chat.${!eff ? ' Auto-reply is off in Settings.' : ''}`;
  const dis = isBusy('save') ? 'disabled' : '';
  return `<div class="dsec"><h5>AI for this chat ${aiBtn(l)}</h5>
    <div class="setrow"><span>${aim(st)}<span class="meta" style="display:block;margin-top:2px">${expl}</span></span></div>
    ${envKill() ? `<div class="warnbox">${ic('alert', 'sm')}<span><b>CRM AI is switched off on the server.</b> The env kill switch overrides every chat.</span></div>` : ''}
    <div style="margin-top:10px"><span class="flabel">How AI sends</span><div class="aiseg" role="radiogroup" aria-label="How AI sends"><button role="radio" aria-checked="${mode === 'autopilot'}" class="${mode === 'autopilot' ? 'on' : ''}" data-act="sendMode" data-v="autopilot" ${dis}>Autopilot</button><button role="radio" aria-checked="${mode === 'draft'}" class="${mode === 'draft' ? 'on' : ''}" data-act="sendMode" data-v="draft" ${dis}>Draft for review</button></div>
    <div class="aiexp">${mode === 'autopilot' ? 'Autopilot sends AI replies immediately, no review.' : 'AI writes a draft. Nothing sends until you approve it.'}</div></div></div>`;
}
function saleBlock(l, hl) {
  const d = D(l), dis = isBusy('save') ? 'disabled' : '';
  const gaps = [l.plan, l.contract_status, l.booked_by, l.closed_by].filter((x) => !x).length;
  const showGaps = gaps && soldish(l);
  const status = l.onboarding ? `<button class="lnk" data-act="openUnit" data-id="${esc(l.id)}">${esc(onboardingLine(l.onboarding))}${l.onboarding.address ? ' · ' + esc(l.onboarding.address) : ''} →</button>` : l.status === 'won' ? '<span class="gapchip">Not started</span>' : '<span class="meta">Starts once the lead is Won</span>';
  const act = l.onboarding ? `<button class="btn" style="width:100%;margin-top:10px" data-act="openUnit" data-id="${esc(l.id)}">Open unit ${ic('arrow', 'sm')}</button>`
    : l.status === 'won' ? `<button class="btn primary" style="width:100%;margin-top:10px" data-act="startOnboarding">${ic('plus', 'sm')}Start onboarding</button>` : '';
  return `<div class="dsec ${hl ? 'hl' : ''}"><h5>Sale and onboarding ${showGaps ? `<span class="gapchip">${gaps} gap${gaps > 1 ? 's' : ''}</span>` : ''}</h5>
    <div class="two">
      <div class="field"><label for="slPlan">Plan</label><select id="slPlan" class="input ${!l.plan ? 'warn' : ''}" data-sel="plan" ${dis}>${opt('', 'Not recorded', l.plan || '')}${PLAN_OPTIONS.map((p) => opt(p, p, l.plan || '')).join('')}</select></div>
      <div class="field"><label for="slCon">Contract</label><select id="slCon" class="input ${!l.contract_status ? 'warn' : ''}" data-sel="contractStatus" ${dis}>${CONTRACT_OPTIONS.map((c) => opt(c.value, c.label, l.contract_status || '')).join('')}</select></div>
      <div class="field"><label for="slBk">Booked by</label><input id="slBk" class="input ${!l.booked_by ? 'warn' : ''}" data-k="ld.booked" data-save="bookedBy" value="${esc(d.booked)}" placeholder="Not recorded"></div>
      <div class="field"><label for="slCl">Closed by</label><input id="slCl" class="input ${!l.closed_by ? 'warn' : ''}" data-k="ld.closed" data-save="closedBy" value="${esc(d.closed)}" placeholder="Not recorded"></div>
      ${l.source === 'Referral' ? `<div class="field full"><label>Referred by</label><span class="input" style="display:flex;align-items:center">${d.referred ? esc(d.referred) : '<span class="gap">Not recorded</span>'}</span></div>` : ''}
    </div>
    <dl class="kv" style="margin-top:10px"><dt>Onboarding</dt><dd>${status}</dd></dl>${act}
    ${showGaps ? `<div class="warnbox">${ic('alert', 'sm')}<span><b>Missing sale details.</b> Fill these before the lead is Won. Onboarding flags any that are still empty.</span></div>` : ''}</div>`;
}
function stageBlock(l) {
  const dis = isBusy('save') ? 'disabled' : '';
  return `<div class="dsec"><h5>Stage and path</h5><div class="two">
    <div class="field"><label for="stSel">Stage</label><select id="stSel" class="input" data-sel="status" ${dis}>${LEAD_STATUSES.map((s) => opt(s, STATUS_LABEL[s] || s, l.status)).join('')}</select></div>
    <div class="field"><label for="pathSel">Path</label><select id="pathSel" class="input" data-sel="offerPath" ${dis}>${OFFER_PATHS.map((p) => opt(p, OFFER_PATH_LABEL[p] || p, l.offer_path)).join('')}</select></div></div></div>`;
}
const notSet = (v, w = 'Not set') => v ? esc(v) : `<span class="meta">${w}</span>`;
function contactBlock(l) {
  const phoneOk = phoneUsable(l.phone);
  const op = callbackPhone();
  let phone;
  if (S.phoneEdit != null) phone = `<div class="phedit"><input class="input focus" type="tel" inputmode="tel" data-k="phoneEdit" value="${esc(S.phoneEdit)}" placeholder="Phone number" aria-label="Phone number"><button class="btn sm primary" data-act="savePhone" ${isBusy('save') ? 'disabled' : ''}>Save</button><button class="btn sm ghost" data-act="cancelPhone">Cancel</button></div>`;
  else if (phoneOk) phone = `<span class="phv">${esc(fmtPhone(l.phone))}<button class="iconbtn" data-act="copyPhone" data-id="${esc(l.id)}" title="Copy phone" aria-label="Copy phone">${ic('copy', 'xs')}</button><button class="iconbtn" data-act="editPhone" title="Edit" aria-label="Edit phone">${ic('edit', 'xs')}</button></span>`;
  else phone = `<span class="phv" style="gap:6px"><span class="gapchip">${ic('alert', 'xs')}Missing number</span><button class="btn sm" data-act="editPhone">Add</button></span>`;
  const listing = l.listing_title ? esc(l.listing_title) : l.has_listing === 'yes' ? 'Has a listing' : l.has_listing === 'no' ? 'No Airbnb yet' : '<span class="meta">Not set</span>';
  const canCall = phoneOk && Boolean(op) && !isBusy('call');
  const preDone = Boolean(S.preCall[l.id]) || S.th.messages.some((m) => m.direction === 'outbound' && ((m.meta && m.meta.pre_call === true) || /calling you in a minute from this number/i.test(m.body || '')));
  const tel = phoneOk ? telHref(l.phone) : null;
  return `<div class="dsec"><h5>Contact and property</h5>
    <dl class="kv"><dt>Phone</dt><dd>${phone}</dd>
      <dt>Email</dt><dd>${l.email ? `<a class="lnk" href="mailto:${esc(l.email)}">${esc(l.email)}</a>` : '<span class="meta">Not set</span>'}</dd>
      <dt>Address</dt><dd>${notSet(l.address)}</dd>
      <dt>Airbnb listing</dt><dd>${listing}</dd>
      <dt>Process stage</dt><dd>${notSet(PROCESS_LABEL[l.property_stage] || l.property_stage, 'Unknown')}</dd>
      <dt>STR allowed</dt><dd>${notSet(STR_LABEL[l.str_allowed] || l.str_allowed, 'Unknown')}</dd>
      <dt>Permit status</dt><dd>${notSet(PERMIT_LABEL[l.permit_status] || l.permit_status, 'Unknown')}</dd>
      <dt>Source</dt><dd>${notSet(l.source)}</dd>
      <dt>Added</dt><dd>${notSet(shortDate(l.created_at))}</dd></dl>
    <div class="two" style="margin-top:10px">
      <a class="btn ${tel ? '' : 'dis'}" ${tel ? `href="${tel}"` : 'aria-disabled="true" tabindex="-1"'}>${ic('phone', 'sm')}Dial from this phone</a>
      <button class="btn ${canCall ? 'primary' : ''}" data-act="crmCall" ${canCall ? '' : 'disabled'}>${ic('rec', 'sm')}${isBusy('call') ? 'Starting…' : preDone ? 'CRM call again' : 'CRM call'}</button></div>
    ${phoneOk && op ? `<div class="meta" style="margin-top:6px">${preDone ? 'Rings your callback phone first, then connects the lead. No new text.' : 'CRM call texts the lead once, rings your callback phone first, then the lead. Calls are recorded.'}</div>` : ''}
    ${S.callMsg ? `<div class="okbox">${ic('phone', 'sm')}<span>${esc(S.callMsg)}</span></div>` : ''}
    ${phoneOk && !op ? `<div class="warnbox">${ic('alert', 'sm')}<span><b>Set your callback phone in Settings first.</b> CRM call rings that phone before the lead. <button class="lnk" data-act="goSettings">Open Settings →</button></span></div>` : ''}
    ${isTwilioSender(op) ? `<div class="warnbox">${ic('alert', 'sm')}<span><b>Callback is set to the Twilio SMS number.</b> Use the business line or a cell instead.</span></div>` : ''}
    ${!phoneOk ? `<div class="warnbox">${ic('alert', 'sm')}<span><b>Missing number.</b> Texting, Dial and CRM call stay off until a phone is saved.</span></div>` : ''}</div>`;
}
function notesBlock(l) {
  const d = D(l), dis = isBusy('save') ? 'disabled' : '';
  const steps = l.playbook_steps || [];
  const stepRow = (s) => s.status === 'done'
    ? `<li class="done"><span class="cbx on">${ic('check', 'xs')}</span><span>${esc(s.title)}</span><span class="meta">Done</span></li>`
    : s.status === 'current'
      ? `<li><span class="cbx"></span><span>${esc(s.title)}</span><button class="btn sm" data-act="pbComplete" ${dis}>Complete</button><button class="btn sm ghost" data-act="pbSkip" ${dis}>Skip</button></li>`
      : `<li><span class="cbx"></span><span>${esc(s.title)}</span><span class="meta">Up next</span></li>`;
  return `<div class="dsec"><h5>Tell the AI <button class="btn sm" data-act="saveNotes" ${dis}>Save</button></h5><textarea class="input" style="min-height:62px" data-k="ld.notes" data-save="notes" placeholder="What the AI should know about this lead before the next text…">${esc(d.notes)}</textarea><div class="hint">The AI uses this on the next SMS. Saves when you click away.</div></div>
   <div class="dsec"><h5>Team next</h5>${steps.length ? `<ul class="steps">${steps.map(stepRow).join('')}</ul>` : '<div class="meta">No next steps yet.</div>'}</div>
   <div class="dsec"><h5>Call notes <span class="meta">After a CRM call</span></h5><textarea class="input" style="min-height:56px" data-k="ld.callNotes" data-save="callNotes" placeholder="What was discussed on the call…">${esc(d.callNotes)}</textarea></div>`;
}
function actionsBlock() {
  const dis = isBusy('save') ? 'disabled' : '';
  return `<div class="dsec"><h5>Actions</h5><div style="display:flex;flex-direction:column;gap:6px">
   <button class="btn" data-act="convertClient">${ic('file', 'sm')}Create client and send contract</button><button class="btn" data-act="markBooked" ${dis}>${ic('cal', 'sm')}Mark booked</button><button class="btn dangerline" data-act="askDelete" ${dis}>${ic('trash', 'sm')}Delete contact</button></div></div>`;
}
function leadPanel(l) {
  let order = ['ai', 'sale', 'stage', 'contact', 'notes', 'actions'];
  const hl = l.status === 'won' || Boolean(l.onboarding);
  if (hl) order = ['sale', 'ai', 'stage', 'contact', 'notes', 'actions'];
  else if (!phoneUsable(l.phone)) order = ['contact', 'ai', 'stage', 'sale', 'notes', 'actions'];
  const map = { ai: () => aiBlock(l), sale: () => saleBlock(l, hl), stage: () => stageBlock(l), contact: () => contactBlock(l), notes: () => notesBlock(l), actions: () => actionsBlock() };
  return `<div class="card lpanel t-${S.ptab}">${leadHeader(l)}
    <div class="plseg"><div class="pseg two" role="tablist"><button role="tab" data-act="ptab" data-v="chat" class="${S.ptab === 'chat' ? 'on' : ''}">Chat</button><button role="tab" data-act="ptab" data-v="details" class="${S.ptab === 'details' ? 'on' : ''}">Details</button></div></div>
    <div class="thread">${thread(l)}</div><div class="details" data-scroll="details">${order.map((b) => map[b]()).join('')}</div></div>`;
}
function leadView() {
  const l = leadById(S.leadId);
  const list = filtered();
  const listcol = `<div class="listcol">
      <div class="filters" style="margin-bottom:8px"><div class="search">${ic('search', 'sm')}<input class="input" type="search" data-k="f.q" value="${esc(S.f.q)}" placeholder="Search leads" aria-label="Search leads"></div>${refreshBtn()}</div>
      <div class="filters">${chipSeg()}<button class="btn sm ${filterCount() ? 'filtbtn on' : ''}" style="height:36px;display:inline-flex" data-act="filters">${ic('filter', 'xs')}Filters${filterCount() ? ` · ${filterCount()}` : ''}</button></div>
      <div class="card clist" data-scroll="clist">${list.length ? list.map(crow).join('') : `<div class="empty" style="padding:24px"><b style="font-size:var(--t-sm)">${S.f.needs && !filterCount() ? 'All caught up' : 'No leads match'}</b></div>`}</div></div>`;
  if (!l) {
    const body = !S.loaded ? `<div class="card"><div class="empty"><span class="refreshing"><i class="spin"></i>Loading lead…</span></div></div>`
      : emptyCard('search', 'This lead was not found', 'It may have been deleted.', '<button class="btn sm" data-act="closeLead" style="margin-top:6px">Back to contacts</button>');
    return `<div class="split">${listcol}<div>${body}</div></div>`;
  }
  return `<div class="split">${listcol}${leadPanel(l)}</div>`;
}

/* =========================================================
   Knowledge
   ========================================================= */
const isPasted = (d) => /\.md$/i.test(d.filename || '');
function kst(d) {
  if (d.status === 'ready') return `<button class="kst ok" data-act="kEdit" data-id="${esc(d.id)}">${ic('check', 'xs')}Ready · tap to edit</button>`;
  if (d.status === 'processing') return '<span class="kst wait"><i class="spin"></i>Processing…</span>';
  return `<span class="kst bad" title="${esc(d.error || '')}">${ic('alert', 'xs')}Failed <button class="btn sm" data-act="kRetry" data-id="${esc(d.id)}" ${isBusy('kUp') ? 'disabled' : ''}>Retry</button></span>`;
}
function krow(d) {
  const meta = `${isPasted(d) ? 'Pasted text' : 'Uploaded'} · ${shortDate(d.created_at)}${d.status === 'failed' && d.error ? ' · ' + d.error : ''}`;
  return `<div class="krow"><span class="kic">${ic(isPasted(d) ? 'text' : 'file', 'sm')}</span>
    <button class="kmain" data-act="kEdit" data-id="${esc(d.id)}"><b>${esc(d.title || d.filename || 'Untitled')}</b><span class="meta">${esc(meta)}</span></button>
    ${kst(d)}
    <span class="kact">${d.status === 'ready' ? `<button class="switch ${d.active ? 'on' : ''}" role="switch" aria-checked="${Boolean(d.active)}" aria-label="${d.active ? 'Turn off' : 'Turn on'} ${esc(d.title)}" data-act="kToggle" data-id="${esc(d.id)}"><i></i></button>${d.active ? 'Active' : 'Off'}` : '<span class="meta">Active after ready</span>'}</span>
    <button class="iconbtn" data-act="kDelete" data-id="${esc(d.id)}" aria-label="Delete ${esc(d.title)}">${ic('trash', 'sm')}</button></div>`;
}
const fileInput = (k) => `<input type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" data-file="${k}" hidden>`;
function knowledgeView() {
  const busy = isBusy('kUp');
  const docs = S.docs;
  const active = docs.filter((d) => d.active).length;
  const add = `<div class="card kadd" style="margin-bottom:14px"><div class="cardhead"><h3>Add to knowledge</h3><span class="meta">The AI uses active documents when it replies</span></div>
    <div class="cardbody"><div class="kaddgrid">
      <label class="drop ${busy ? 'busy' : ''}">${fileInput('kUpload')}${busy ? '<i class="spin"></i>' : ic('upload')}Upload a file<span class="meta">PDF, DOCX or TXT</span></label>
      <div class="kpaste"><input class="input" data-k="kUp.title" value="${esc(S.kUp.title)}" placeholder="Title (used for the upload or the pasted text)" aria-label="Title"><textarea class="input" data-k="kUp.text" placeholder="Paste text the AI should know…" aria-label="Text">${esc(S.kUp.text)}</textarea><div style="display:flex;justify-content:flex-end"><button class="btn primary sm" data-act="kAddPaste" ${busy ? 'disabled' : ''}>${ic('plus', 'xs')}Add pasted text</button></div></div>
    </div></div></div>
    <div class="kphone"><label class="btn ${busy ? 'dis' : ''}">${fileInput('kUpload')}${ic('upload', 'sm')}Upload file</label><button class="btn" data-act="kPasteSheet">${ic('text', 'sm')}Paste text</button></div>`;
  const err = S.docsErr ? `<div class="warnbox" style="margin:0 0 12px">${ic('alert', 'sm')}<span>${esc(S.docsErr)}</span></div>` : '';
  const list = !S.docsLoaded ? `<div class="empty"><span class="refreshing"><i class="spin"></i>Loading documents…</span></div>`
    : docs.length ? docs.map(krow).join('')
    : `<div class="empty"><span class="eic">${ic('book')}</span><b>No documents yet</b><span>Upload a file or paste text so the AI can answer owner questions.</span></div>`;
  return `${add}${err}<div class="card"><div class="cardhead"><h3>Documents <span class="count">${docs.length}</span></h3><span class="meta">${active} active</span></div>${list}</div>`;
}

/* =========================================================
   Settings
   ========================================================= */
function settingsView() {
  const st = S.settings || {};
  const set = S.set;
  const loaded = Boolean(S.settings);
  const autoOn = Boolean(st.ai_responses_enabled) && !envKill();
  const sAuto = `<div class="card"><div class="cardbody setrow"><span><b>Auto-reply to new SMS</b><span class="meta">When on, the AI answers new texts using each chat’s AI setting. When off, every chat waits for the team, unless you enable AI on one lead.${envKill() ? ' The server kill switch is on and overrides this.' : ''}</span></span><button class="switch ${autoOn ? 'on' : ''}" role="switch" aria-checked="${autoOn}" aria-label="Auto-reply to new SMS" data-act="toggleAuto" ${!loaded || envKill() || isBusy('globalAi') ? 'disabled' : ''}><i></i></button></div></div>`;
  const p = set.preview;
  let prev = '';
  if (p && p.parsed) {
    const pr = p.parsed;
    const rows = [
      ['Name', pr.name], ['Phone', pr.phone ? fmtPhone(pr.phone) : ''], ['Email', pr.email], ['Address', pr.address],
      ['Has listing', pr.hasListing === 'yes' ? 'Yes' : pr.hasListing === 'no' ? 'No' : ''], ['Listing', pr.listingTitle],
      ['Process stage', PROCESS_LABEL[pr.propertyStage] || pr.propertyStage], ['STR allowed', STR_LABEL[pr.strAllowed] || pr.strAllowed],
      ['Earnings', pr.earnings], ['Path', OFFER_PATH_LABEL[pr.offerPath] || pr.offerPath],
      ['Lands as', p.decision ? `${STATUS_LABEL[p.decision.status] || p.decision.status}${p.decision.reason ? ' · ' + p.decision.reason : ''}` : ''],
    ].filter(([, v]) => v);
    prev = `<span class="flabel">Preview</span><dl class="ptable">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      ${p.duplicate ? `<div class="warnbox">${ic('alert', 'sm')}<span><b>Already in the CRM:</b> ${esc(p.duplicate.name)} (${esc(STATUS_LABEL[p.duplicate.status] || p.duplicate.status)}). Importing updates that lead.</span></div>` : ''}
      ${(pr.warnings || []).map((w) => `<div class="warnbox">${ic('alert', 'sm')}<span>${esc(w)}</span></div>`).join('')}`;
  }
  const pBusy = isBusy('paste');
  const sMeta = `<div class="card"><div class="cardhead"><h3>${ic('users', 'sm')}Paste a Meta lead</h3></div><div class="cardbody">
    <textarea class="input pastebox" style="min-height:120px" data-k="set.paste" placeholder="Paste the lead from Meta here, one field per line…" aria-label="Meta lead text">${esc(set.paste)}</textarea>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin:10px 0 12px"><button class="btn sm" data-act="pastePreview" ${pBusy || !set.paste.trim() ? 'disabled' : ''}>${ic('eye', 'xs')}Preview</button></div>
    ${prev}
    ${set.pErr ? `<div class="hint bad">${ic('alert', 'xs')}${esc(set.pErr)}</div>` : ''}
    ${set.pMsg ? `<div class="okbox">${ic('check', 'sm')}<span>${esc(set.pMsg)}</span></div>` : ''}
    <div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn primary" data-act="pasteImport" ${pBusy || !set.paste.trim() ? 'disabled' : ''}>${ic('plus', 'sm')}${pBusy ? 'Working…' : 'Import lead'}</button></div></div></div>`;
  const op = callbackPhone();
  const sCalls = `<div class="card"><div class="cardhead"><h3>${ic('phone', 'sm')}CRM calls</h3></div><div class="cardbody" style="display:flex;flex-direction:column;gap:12px">
    <div class="field"><label for="ringFirst">Whose phone rings first</label><select id="ringFirst" class="input" aria-describedby="ringFirstHint"><option>The callback phone below</option></select><div class="hint" id="ringFirstHint">Whoever answers the callback phone is connected to the lead.</div></div>
    <div class="field"><label for="opPhone">Callback phone</label><input id="opPhone" class="input" type="tel" inputmode="tel" autocomplete="tel" data-k="set.op" value="${esc(set.op)}" placeholder="Business line or your cell"><div class="hint">Rings first, then connects to the lead. Calls are recorded. Don’t use the Twilio SMS number.</div></div>
    ${isTwilioSender(op) ? `<div class="warnbox">${ic('alert', 'sm')}<span><b>This is the Twilio SMS number.</b> Use the business line or a cell instead.</span></div>` : ''}
    <div style="display:flex;justify-content:flex-end;align-items:center;gap:10px">${set.opMsg ? `<span class="meta">${esc(set.opMsg)}</span>` : ''}<button class="btn primary sm" data-act="saveOp" ${isBusy('op') || set.op.trim() === op ? 'disabled' : ''}>${isBusy('op') ? 'Saving…' : 'Save'}</button></div></div></div>`;
  const recips = Array.isArray(st.lead_notify_recipients) && st.lead_notify_recipients.length ? st.lead_notify_recipients
    : String(st.lead_notify_phone || '').split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean).map((phone, i) => ({ id: `legacy_${i}_${phone}`, name: '', phone, welcome_sent_at: null }));
  const nb = isBusy('notify');
  const person = (r) => `<li><span class="av sm" style="background:${r.name ? `oklch(0.5 0.11 ${AVC[hashIdx(r.id)]})` : 'oklch(0.55 0.01 270)'}">${r.name ? esc(initials(r.name)) : '?'}</span><span class="t"><b>${esc(r.name || fmtPhone(r.phone))}</b>${r.name ? `<span class="meta">${esc(fmtPhone(r.phone))}</span>` : ''}${r.welcome_sent_at ? '' : '<span class="meta" style="color:var(--amberink);display:block">Re-save with a name to verify</span>'}</span>
    ${r.welcome_sent_at ? chip('Verified', 155, .13) : `<button class="btn sm" data-act="notifyVerify" data-phone="${esc(r.phone)}" data-name="${esc(r.name || '')}" ${nb ? 'disabled' : ''}>Verify</button>`}<button class="btn sm ghost" data-act="notifyRemove" data-id="${esc(r.id)}" ${nb ? 'disabled' : ''}>Remove</button></li>`;
  const sAlerts = `<div class="card"><div class="cardhead"><h3>${ic('bell', 'sm')}New lead text alerts</h3><button class="switch ${st.lead_notify_sms_enabled ? 'on' : ''}" role="switch" aria-checked="${Boolean(st.lead_notify_sms_enabled)}" aria-label="New lead text alerts" data-act="notifyToggle" ${!loaded || nb ? 'disabled' : ''}><i></i></button></div><div class="cardbody">
    <div class="hint" style="margin:0 0 6px">A text with the lead’s details and a link to the contact, sent to everyone below.</div>
    ${recips.length ? `<ul class="people">${recips.map(person).join('')}</ul>` : '<div class="meta" style="padding:6px 0">Nobody gets alerts yet.</div>'}
    <div class="addrow"><input class="input" data-k="set.nName" value="${esc(set.nName)}" placeholder="Name" aria-label="Name"><input class="input" type="tel" inputmode="tel" data-k="set.nPhone" value="${esc(set.nPhone)}" placeholder="Phone" aria-label="Phone"><button class="btn" data-act="notifyAdd" ${nb || !set.nPhone.trim() ? 'disabled' : ''}>${ic('plus', 'sm')}Add person</button></div>
    ${set.nMsg ? `<div class="hint">${esc(set.nMsg)}</div>` : ''}</div></div>`;
  const codes = Array.isArray(st.unlock_codes) ? st.unlock_codes : [];
  const ub = isBusy('unlock');
  const codeRow = (c) => `<li><span class="t"><span class="code">${esc(c.code)}</span>${c.label ? `<span class="meta">${esc(c.label)}</span>` : ''}<span class="meta" style="display:block">${c.redeemed_at ? `Created ${esc(shortDate(c.created_at))} · used ${esc(shortDate(c.redeemed_at))}${c.redeemed_by_email ? ' · ' + esc(c.redeemed_by_email) : ''}` : `Created ${esc(shortDate(c.created_at))} · not used`}</span></span>${c.redeemed_at ? chip('Used', 270, .02) : `<button class="iconbtn" data-act="copyCode" data-code="${esc(c.code)}" aria-label="Copy code ${esc(c.code)}" title="Copy code">${ic('copy', 'xs')}</button>`}</li>`;
  const sCodes = `<div class="card"><div class="cardhead"><h3>${ic('key', 'sm')}Revenue audit unlock codes</h3><button class="btn sm primary" data-act="createCode" ${ub || set.uCode.trim().length < 4 ? 'disabled' : ''}>${ic('plus', 'xs')}${ub ? 'Saving…' : 'Create code'}</button></div><div class="cardbody">
    <div class="hint" style="margin:0 0 10px">One-time code a client enters to unlock their revenue audit.</div>
    <div class="addrow" style="grid-template-columns:1fr 1fr;margin:0 0 10px"><input class="input" data-k="set.uCode" value="${esc(set.uCode)}" placeholder="Code, at least 4 characters" aria-label="Code" style="text-transform:uppercase"><input class="input" data-k="set.uLabel" value="${esc(set.uLabel)}" placeholder="Client name (optional)" aria-label="Client name"></div>
    ${set.uMsg ? `<div class="hint" style="margin:0 0 8px">${esc(set.uMsg)}</div>` : ''}
    ${codes.length ? `<ul class="people">${codes.map(codeRow).join('')}</ul>` : '<div class="empty" style="padding:18px"><b style="font-size:var(--t-sm)">No codes yet</b></div>'}</div></div>`;
  const sOut = `<div class="card"><div class="cardbody setrow"><span><b>Log out</b><span class="meta">Signed in as Admin</span></span><button class="btn" data-act="logout">${ic('out', 'sm')}Log out</button></div></div>`;
  const loading = !loaded ? `<div class="meta" style="margin-bottom:12px;display:flex;gap:6px;align-items:center"><i class="spin"></i>Loading settings…</div>` : '';
  return `${loading}<div class="setgrid"><div class="setcol">${sAuto}${sMeta}</div><div class="setcol">${sCalls}${sAlerts}${sCodes}${sOut}</div></div>`;
}

/* =========================================================
   Overlays: + Lead, delete, filters, editor, paste, Ctrl+K
   ========================================================= */
function nlHints() {
  const n = S.nl; if (!n) return { name: '', phone: '' };
  const clean = n.name.replace(/\s+/g, ' ').trim();
  const d = digitsOf(n.phone).replace(/^1(?=\d{10}$)/, '');
  return {
    name: clean ? `${ic('check', 'xs')}Saves as ${esc(clean)}` : '',
    nameCls: 'good',
    phone: !n.phone.trim() ? '' : d.length === 10 ? `${ic('check', 'xs')}Saves as ${esc(fmtPhone(d))}` : `${ic('alert', 'xs')}Check the number: a 10 digit CA/US phone`,
    phoneCls: d.length === 10 ? 'good' : 'warn',
  };
}
function newLeadForm() {
  const n = S.nl, h = nlHints();
  return `<form class="modal frost" id="nlForm" role="dialog" aria-modal="true" aria-labelledby="nlTitle" novalidate><h2 id="nlTitle">New lead</h2><p class="lede">Saves at the New stage with the AI paused.</p>
    <div class="fgrid">
      <div class="field full"><label for="nlName">Name</label><input id="nlName" class="input" data-k="nl.name" value="${esc(n.name)}" placeholder="Client name" autocomplete="off"><div class="hint ${h.nameCls}" data-hint="name">${h.name}</div></div>
      <div class="field"><label for="nlPhone">Phone</label><input id="nlPhone" class="input" type="tel" inputmode="tel" data-k="nl.phone" value="${esc(n.phone)}" placeholder="Any format"><div class="hint ${h.phoneCls}" data-hint="phone">${h.phone}</div></div>
      <div class="field"><label for="nlEmail">Email</label><input id="nlEmail" class="input" type="email" inputmode="email" data-k="nl.email" value="${esc(n.email)}" placeholder="Email address"></div>
      <div class="field full"><label for="nlAddr">Property address <em>(optional)</em></label><input id="nlAddr" class="input" data-k="nl.address" value="${esc(n.address)}" placeholder="Start typing an address…"></div>
      <div class="field"><label for="nlSrc">Source</label><select id="nlSrc" class="input" data-sel="nl.source">${LEAD_SOURCES.map((s) => opt(s, s, n.source)).join('')}</select></div>
      ${n.source === 'Referral' ? `<div class="field"><label for="nlRef">Referred by</label><input id="nlRef" class="input" data-k="nl.referredBy" value="${esc(n.referredBy)}" placeholder="Who referred them"><div class="hint">Shown for Referral only</div></div>` : ''}
      <div class="field full"><label for="nlNotes">Notes <em>(optional)</em></label><textarea id="nlNotes" class="input" style="min-height:64px" data-k="nl.notes" placeholder="Anything from the first contact">${esc(n.notes)}</textarea></div></div>
    <div class="hint" style="margin-top:12px">${ic('pause', 'xs')}AI starts paused for manual leads. Turn it on from the lead when you’re ready.</div>
    ${n.err ? `<div class="hint bad">${ic('alert', 'xs')}${esc(n.err)}</div>` : ''}
    <div class="mfoot"><button type="button" class="btn" data-act="closeModal">Cancel</button><button type="submit" class="btn primary" id="nlSave" ${n.busy || !n.name.trim() ? 'disabled' : ''}>${n.busy ? 'Saving…' : 'Save lead'}</button></div></form>`;
}
function filterSheet() {
  const f = S.f;
  const seg = (k, opts) => `<div class="aiseg three">${opts.map(([v, l]) => `<button type="button" class="${f[k] === v ? 'on' : ''}" data-act="fset" data-f="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
  return `<div class="modal frost" role="dialog" aria-modal="true" aria-labelledby="fTitle"><h2 id="fTitle" style="font-size:18px;margin-bottom:12px">Filters</h2>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div class="field"><label for="fsPath">Path</label><select id="fsPath" class="input" data-sel="f.path">${opt('all', 'All paths', f.path)}${OFFER_PATHS.map((p) => opt(p, OFFER_PATH_LABEL[p] || p, f.path)).join('')}</select></div>
      <div class="field"><label for="fsStage">Stage</label><select id="fsStage" class="input" data-sel="f.stage">${opt('all', 'All stages', f.stage)}${LEAD_STATUSES.map((s) => opt(s, STATUS_LABEL[s] || s, f.stage)).join('')}</select></div>
      <div class="field"><span class="flabel">AI</span>${seg('ai', [['all', 'All'], ['live', 'Live'], ['paused', 'Paused']])}</div>
      <div class="setrow"><b style="font-size:var(--t-sm)">Booked this week</b><button type="button" class="switch ${f.booked ? 'on' : ''}" role="switch" aria-checked="${f.booked}" aria-label="Booked this week" data-act="bookedWeek"><i></i></button></div>
      <div class="field"><span class="flabel">Sort</span>${seg('sort', [['inbox', 'Inbox'], ['newest', 'Newest'], ['oldest', 'Oldest']])}</div></div>
    <div class="mfoot"><button type="button" class="btn ghost" data-act="clearFilters">Clear filters</button><button type="button" class="btn primary" style="flex:1" data-act="closeModal">Show results</button></div></div>`;
}
function editorSheet() {
  const e = S.ed;
  return `<div class="frost editor" role="dialog" aria-modal="true" aria-labelledby="edTitle"><div class="edhead"><h2 id="edTitle">Edit document</h2><button class="iconbtn" data-act="closeModal" aria-label="Close">${ic('x')}</button></div>
    ${e.loading ? '<div class="empty"><span class="refreshing"><i class="spin"></i>Opening…</span></div>' : `<div class="field"><label for="edT">Title</label><input id="edT" class="input" data-k="ed.title" value="${esc(e.title)}"></div>
    <div class="field" style="flex:1;display:flex;flex-direction:column"><label for="edX">Content</label><textarea id="edX" class="input" data-k="ed.text">${esc(e.text)}</textarea></div>`}
    ${e.err ? `<div class="hint bad">${ic('alert', 'xs')}${esc(e.err)}</div>` : ''}
    <div class="mfoot"><button class="btn" data-act="closeModal" ${e.busy ? 'disabled' : ''}>Cancel</button><button class="btn primary" data-act="edSave" ${e.busy || e.loading ? 'disabled' : ''}>${e.busy ? 'Saving…' : 'Save'}</button></div></div>`;
}
function pasteSheet() {
  return `<div class="modal frost" role="dialog" aria-modal="true" aria-labelledby="psTitle"><h2 id="psTitle" style="font-size:18px">Paste text</h2><p class="lede">The AI uses it once it’s ready and active.</p>
    <div style="display:flex;flex-direction:column;gap:10px"><div class="field"><label for="psT">Title</label><input id="psT" class="input" data-k="kUp.title" value="${esc(S.kUp.title)}"></div>
    <div class="field"><label for="psX">Text</label><textarea id="psX" class="input" style="min-height:200px" data-k="kUp.text" placeholder="Paste text the AI should know…">${esc(S.kUp.text)}</textarea></div></div>
    <div class="mfoot"><button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="kAddPaste" ${isBusy('kUp') ? 'disabled' : ''}>${ic('plus', 'sm')}Add pasted text</button></div></div>`;
}
function confirmBox() {
  const m = S.modal;
  return `<div class="modal frost narrow" role="alertdialog" aria-modal="true" aria-labelledby="cfTitle"><h2 id="cfTitle">${esc(m.title)}</h2><p class="lede">${esc(m.lede)}</p>
    <div class="mfoot"><button class="btn" data-act="closeModal">Cancel</button><button class="btn danger" data-act="confirmOk" ${m.busy ? 'disabled' : ''}>${ic('trash', 'sm')}${esc(m.okLabel)}</button></div></div>`;
}
function cmdItems() {
  const q = S.cmd.q.trim().toLowerCase();
  const qd = digitsOf(q);
  const leads = !q ? S.leads.slice(0, 6) : S.leads.filter((l) => {
    const hay = [l.name, l.email, l.address, l.listing_title].join(' ').toLowerCase();
    return hay.includes(q) || (qd.length >= 3 && digitsOf(l.phone).includes(qd));
  }).slice(0, 8);
  const acts = [['newLead', 'plus', 'New lead'], ['tab:contacts', 'inbox', 'Contacts'], ['tab:knowledge', 'book', 'Knowledge'], ['tab:settings', 'gear', 'Settings']]
    .filter(([, , l]) => !q || l.toLowerCase().includes(q));
  return [...leads.map((l) => ({ kind: 'lead', l })), ...acts.map(([a, i, l]) => ({ kind: 'act', a, i, l }))];
}
function cmdResults() {
  const items = S.cmd.items = cmdItems();
  if (S.cmd.act >= items.length) S.cmd.act = Math.max(0, items.length - 1);
  let html = '', i = 0, grp = '';
  for (const it of items) {
    const g = it.kind === 'lead' ? 'Leads' : 'Actions';
    if (g !== grp) { html += `<div class="meta grp">${g}</div>`; grp = g; }
    html += it.kind === 'lead'
      ? `<button class="it ${i === S.cmd.act ? 'act' : ''}" data-ci="${i}">${av(it.l, 'sm')}<span>${esc(it.l.name || 'Unnamed lead')}</span><span class="meta">${esc([phoneUsable(it.l.phone) ? fmtPhone(it.l.phone) : '', STATUS_LABEL[it.l.status] || ''].filter(Boolean).join(' · '))}</span></button>`
      : `<button class="it ${i === S.cmd.act ? 'act' : ''}" data-ci="${i}">${ic(it.i, 'sm')}<span>${it.l}</span></button>`;
    i++;
  }
  return html || '<div class="empty" style="padding:24px"><b style="font-size:var(--t-sm)">No matches</b></div>';
}
function cmdk() {
  return `<div class="frost cmdk" role="dialog" aria-modal="true" aria-label="Jump to a lead"><div class="cmdq">${ic('search')}<input data-k="cmd.q" value="${esc(S.cmd.q)}" placeholder="Search leads by name, phone, email, address or listing" aria-label="Search leads"><kbd>esc</kbd></div><div class="cmdres" id="cmdRes">${cmdResults()}</div></div>`;
}
function renderOverlay() {
  const m = S.modal;
  const host_ = $('#ov');
  if (!m) { host_.innerHTML = ''; return; }
  const kind = m.kind;
  const cls = kind === 'editor' ? 'scrim side' : kind === 'cmdk' ? 'scrim top' : 'scrim';
  const inner = kind === 'newLead' ? newLeadForm() : kind === 'filters' ? filterSheet() : kind === 'editor' ? editorSheet() : kind === 'paste' ? pasteSheet() : kind === 'confirm' ? confirmBox() : kind === 'cmdk' ? cmdk() : '';
  host_.innerHTML = `<div class="${cls}" id="scrim">${inner}</div>`;
}
function openModal(m, focusSel) {
  S.modal = m; S.menu = null; renderMenu(); renderOverlay();
  if (focusSel) { const el = root.querySelector(focusSel); if (el) setTimeout(() => el.focus(), 30); }
}
function closeModal() {
  if (S.modal && S.modal.kind === 'editor' && S.ed.busy) return;
  const wasFilters = S.modal && S.modal.kind === 'filters';
  S.modal = null; renderOverlay();
  if (wasFilters) renderMain();
}

/* ---------------- menus ---------------- */
function renderMenu() {
  const mh = $('#menuHost');
  const m = S.menu;
  if (!m) { mh.innerHTML = ''; return; }
  const l = leadById(m.id);
  if (!l) { S.menu = null; mh.innerHTML = ''; return; }
  const items = [];
  if (m.kind === 'row') items.push(`<button data-act="open" data-id="${esc(l.id)}">${ic('sms', 'sm')}Open</button>`);
  items.push(`<button data-act="convertClient" data-id="${esc(l.id)}">${ic('file', 'sm')}Create client and send contract</button>`);
  items.push(`<button data-act="markBooked" data-id="${esc(l.id)}">${ic('cal', 'sm')}Mark booked</button>`);
  if (phoneUsable(l.phone)) items.push(`<button data-act="copyPhone" data-id="${esc(l.id)}">${ic('copy', 'sm')}Copy phone</button>`);
  items.push('<hr>');
  items.push(`<button class="dng" data-act="askDelete" data-id="${esc(l.id)}">${ic('trash', 'sm')}Delete contact</button>`);
  mh.innerHTML = `<div class="menu frost" role="menu" style="left:${m.x}px;top:${m.y}px">${items.join('')}</div>`;
  const el = mh.firstElementChild;
  const r = el.getBoundingClientRect();
  if (r.bottom > window.innerHeight - 8) el.style.top = Math.max(8, m.y - r.height - m.h - 8) + 'px';
}
function openMenu(kind, id, btn) {
  const r = btn.getBoundingClientRect();
  const w = 250;
  S.menu = { kind, id, x: Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)), y: r.bottom + 6, h: r.height };
  renderMenu();
}

/* =========================================================
   Render
   ========================================================= */
let lastMsgKey = '';
function renderContent() {
  const c = $('#content');
  const leadMode = S.tab === 'contacts' && Boolean(S.leadId);
  c.classList.toggle('leadmode', leadMode);
  c.innerHTML = S.tab === 'knowledge' ? knowledgeView() : S.tab === 'settings' ? settingsView() : leadMode ? leadView() : inboxView();
  const msgs = $('#msgs');
  if (msgs) {
    const key = `${S.th.id}:${S.th.messages.length}:${S.th.draft ? S.th.draft.id : ''}`;
    if (key !== lastMsgKey) { lastMsgKey = key; requestAnimationFrame(() => { const m = $('#msgs'); if (m) m.scrollTop = m.scrollHeight; }); }
  }
  sizeComposer();
}
function renderMain() { keepFocus(() => { renderNav(); renderHead(); renderContent(); }); }
function render() { renderMain(); renderOverlay(); renderMenu(); }
function sizeComposer() {
  const t = root.querySelector('.composer textarea');
  if (!t) return;
  t.style.height = 'auto';
  t.style.height = Math.min(Math.max(t.scrollHeight + 2, 44), 180) + 'px';
}

/* =========================================================
   Data loading
   ========================================================= */
let leadsSeq = 0;
async function loadLeads() {
  const seq = ++leadsSeq;
  S.refreshing = true;
  if (S.loaded) renderMain();
  try {
    const q = S.f.q.trim();
    const data = await host.loadLeads(q);
    if (seq !== leadsSeq) return;
    S.leads = (data.leads || []).map(normLead);
    if (!q) S.total = S.leads.length;
    S.loaded = true; S.loadErr = ''; S.updatedAt = Date.now();
  } catch (e) {
    if (seq !== leadsSeq) return;
    S.loadErr = errMsg(e, 'Could not load contacts.');
    S.loaded = true;
    if (!S.leads.length && host.onError) host.onError(e);
  } finally {
    if (seq === leadsSeq) { S.refreshing = false; renderMain(); if (S.modal && S.modal.kind === 'cmdk') refreshCmd(); }
  }
}
async function loadThread(id) {
  try {
    const data = await host.loadFollowups(id);
    if (S.th.id !== id) return;
    S.th.messages = data.messages || [];
    S.th.followups = data.followups || [];
    const nd = data.pending_draft || null;
    if (S.draftEdit && (!nd || nd.id !== S.draftEdit.id)) S.draftEdit = null;
    S.th.draft = nd;
    S.th.loaded = true;
    const patch = {};
    if (data.playbook_steps) patch.playbook_steps = data.playbook_steps;
    if (data.ai_send_mode) patch.ai_send_mode = data.ai_send_mode;
    patch.pending_draft = nd;
    mergeLead(id, patch);
  } catch {
    if (S.th.id !== id) return;
    S.th.loaded = true;
  }
  renderMain();
}
async function loadSettings() {
  try {
    const data = await host.loadSettings();
    S.settings = data || {};
    if (!S.set.opDirty) S.set.op = String(S.settings.operator_callback_phone || '').trim();
  } catch (e) {
    if (!S.settings) S.settings = null;
  }
  renderMain();
}
async function loadDocs() {
  try {
    const data = await host.loadDocs();
    S.docs = data.docs || [];
    S.docsErr = '';
  } catch (e) {
    S.docsErr = errMsg(e, 'Could not load knowledge base.');
  }
  S.docsLoaded = true;
  if (S.tab === 'knowledge') renderMain();
}

/* =========================================================
   Navigation and routing
   ========================================================= */
function setNav(id) {
  const modeMap = { crm: 'crm', ops: 'ops', clients: 'ops', properties: 'ops', team: 'ops', copilot: 'copilot', settings: 'ops', dashboard: 'crm', onboarding: 'onboarding', revenue: 'ops' };
  if (id === 'settings') { setTab('settings'); return; }
  if (id === 'crm' || id === 'dashboard') { S.leadId = null; setTab('contacts'); return; }
  const m = modeMap[id];
  if (m && m !== 'crm' && host.go) {
    if (id === 'clients') { host.go('ops', { opsTab: 'clients' }); return; }
    if (id === 'properties') { host.go('ops', { opsTab: 'properties' }); return; }
    if (id === 'team') { host.go('ops', { opsTab: 'employees' }); return; }
    if (id === 'revenue') { host.go('ops', { opsTab: 'month' }); return; }
    host.go(m);
  }
}
function setTab(t, opts = {}) {
  S.tab = t;
  if (t !== 'contacts') S.leadId = null;
  S.menu = null;
  if (!opts.noRoute && host.setRoute) host.setRoute({ tab: t, leadId: t === 'contacts' ? S.leadId : null });
  if (t === 'knowledge') loadDocs();
  if (t === 'settings') loadSettings();
  render();
  const c = $('#content'); if (c) c.scrollTop = 0;
  if (window.matchMedia('(max-width:767px)').matches) window.scrollTo({ top: 0 });
}
function openLead(id, opts = {}) {
  if (!id) return;
  id = String(id);
  const same = S.leadId === id && S.tab === 'contacts';
  S.tab = 'contacts';
  S.leadId = id;
  S.menu = null;
  if (S.modal && S.modal.kind !== 'newLead') S.modal = null;
  if (!opts.noRoute && host.setRoute) host.setRoute({ tab: 'contacts', leadId: id });
  if (!same) {
    S.ptab = 'chat';
    S.phoneEdit = null;
    S.draftEdit = null;
    S.callMsg = '';
    S.sms = ssGet(`mrg_sms_${id}`);
    S.th = { id, messages: [], followups: [], draft: null, loaded: false };
    lastMsgKey = '';
    loadThread(id);
    if (host.markRead) host.markRead(id).catch(() => undefined);
    const l = leadById(id);
    if (l) mergeLead(id, { unread: false, sms_last_read_at: new Date().toISOString(), needs_you: l.needs_you.filter((r) => r !== 'unanswered_inbound' && r !== 'review_ai') });
    delete S.ld[id];
  }
  render();
}
function closeLead(opts = {}) {
  S.leadId = null;
  S.th = { id: null, messages: [], followups: [], draft: null, loaded: false };
  S.menu = null;
  if (!opts.noRoute && host.setRoute) host.setRoute({ tab: 'contacts', leadId: null });
  render();
}
function openNewLead() {
  if (S.tab !== 'contacts') setTab('contacts');
  S.nl = { name: '', phone: '', email: '', address: '', source: LEAD_SOURCES.includes('Meta ad') ? 'Meta ad' : (LEAD_SOURCES[0] || ''), referredBy: '', notes: '', err: '', busy: false };
  openModal({ kind: 'newLead' }, '#nlName');
}
function applyRoute(r) {
  if (!r) return;
  const tab = r.tab || 'contacts';
  const leadId = r.leadId ? String(r.leadId) : null;
  if (tab !== S.tab) setTab(tab, { noRoute: true });
  if (tab === 'contacts' && leadId !== S.leadId) { if (leadId) openLead(leadId, { noRoute: true }); else closeLead({ noRoute: true }); }
  if (r.newLead && !(S.modal && S.modal.kind === 'newLead')) openNewLead();
}

/* =========================================================
   Lead actions (each one is a click; nothing sends on its own)
   ========================================================= */
function applyLeadResponse(id, data) {
  if (!data) return;
  if (data.lead) mergeLead(id, data.lead);
  if (S.th.id === id) {
    if (Array.isArray(data.messages)) {
      S.th.messages = data.messages;
      const last = data.messages[data.messages.length - 1];
      if (last) mergeLead(id, { last_activity_at: last.created_at, last_sms: { body: last.body, direction: last.direction, created_at: last.created_at, meta: last.meta } });
    }
    if (Array.isArray(data.followups)) S.th.followups = data.followups;
    if ('pending_draft' in data) { S.th.draft = data.pending_draft || null; S.draftEdit = null; mergeLead(id, { pending_draft: S.th.draft }); }
  }
}
async function patchLead(body, okMsg, id = S.leadId) {
  if (!id) return null;
  setBusy('save', true);
  try {
    const data = await host.patchLead({ id, ...body });
    applyLeadResponse(id, data);
    const msg = typeof okMsg === 'function' ? okMsg(data) : okMsg;
    if (msg) toast(msg);
    return data;
  } catch (e) {
    toast(errMsg(e, 'Save failed'), 'bad');
    return null;
  } finally {
    setBusy('save', false);
  }
}
async function runSave(field, value) {
  const l = leadById(S.leadId); if (!l) return;
  const cur = { notes: l.notes, whatsNext: l.whats_next, callNotes: l.call_notes, bookedBy: l.booked_by, closedBy: l.closed_by, referredBy: l.referred_by }[field] || '';
  const v = ['bookedBy', 'closedBy', 'referredBy'].includes(field) ? value.trim() : value;
  if (v === cur) return;
  const data = await patchLead({ [field]: v }, 'Saved');
  if (data && data.lead) {
    const d = D(leadById(S.leadId));
    const map = { notes: ['notes', 'notes'], whatsNext: ['whatsNext', 'whats_next'], callNotes: ['callNotes', 'call_notes'], bookedBy: ['booked', 'booked_by'], closedBy: ['closed', 'closed_by'], referredBy: ['referred', 'referred_by'] }[field];
    if (map && data.lead[map[1]] !== undefined) d[map[0]] = data.lead[map[1]] || '';
  }
}
async function sendSms() {
  const l = leadById(S.leadId); if (!l || isBusy('sms')) return;
  const text = S.sms.trim(); if (!text) return;
  if (!phoneUsable(l.phone)) { toast('Add a valid phone number for this lead first.', 'bad'); S.ptab = 'details'; S.phoneEdit = ''; renderMain(); return; }
  setBusy('sms', true);
  try {
    const data = await host.sendSms(l.id, text);
    S.sms = ''; ssSet(`mrg_sms_${l.id}`, '');
    applyLeadResponse(l.id, data);
    const now = new Date().toISOString();
    mergeLead(l.id, { ai_paused: true, unread: false, last_activity_at: (S.th.messages[S.th.messages.length - 1] || {}).created_at || now, last_sms: { body: text, direction: 'outbound', created_at: now, meta: { human: true } } });
    toast('Sent. AI paused for this lead');
  } catch (e) {
    toast(errMsg(e, 'SMS failed'), 'bad');
  } finally {
    setBusy('sms', false);
  }
}
async function draftAct(action) {
  const l = leadById(S.leadId); const d = S.th.draft;
  if (!l || !d) return;
  const body = S.draftEdit && S.draftEdit.id === d.id ? S.draftEdit.text : d.body;
  if (action === 'approve' && !body.trim()) return;
  setBusy('save', true);
  try {
    const data = await host.draftAction(l.id, action, d.id, action === 'discard' ? undefined : body);
    applyLeadResponse(l.id, data);
    if (action === 'save') S.draftEdit = null;
    toast(action === 'approve' ? 'Draft sent' : action === 'discard' ? 'Draft discarded' : 'Draft saved');
  } catch (e) {
    toast(errMsg(e, 'Could not update the draft.'), 'bad');
  } finally {
    setBusy('save', false);
  }
}
async function crmCall() {
  const l = leadById(S.leadId); if (!l || isBusy('call')) return;
  setBusy('call', true); S.callMsg = '';
  try {
    const data = await host.startCall(l.id);
    if (data.preCallSmsSent || data.preCallSmsSkipped) S.preCall[l.id] = true;
    S.callMsg = data.preCallSmsSent ? 'Texted the lead once. Now ringing your phone. Answer to connect.' : 'Ringing your phone (no new text). Answer to connect the lead.';
    setTimeout(() => { S.callMsg = ''; renderMain(); }, 6000);
    loadThread(l.id); loadLeads();
  } catch (e) {
    toast(errMsg(e, 'Call failed'), 'bad');
  } finally {
    setBusy('call', false);
  }
}
async function markBooked(id) {
  setBusy('save', true);
  try {
    const data = await host.markBooked(id);
    applyLeadResponse(id, data);
    toast('Marked booked. Follow-up texts stopped');
  } catch (e) {
    toast(errMsg(e, 'Could not mark booked.'), 'bad');
  } finally {
    setBusy('save', false);
  }
}
async function copyText(txt, label) {
  try { await navigator.clipboard.writeText(txt); toast(`${label} copied`); } catch { toast('Could not copy', 'bad'); }
}
function askDelete(id) {
  const l = leadById(id); if (!l) return;
  openModal({ kind: 'confirm', title: `Delete ${l.name || 'this lead'}?`, lede: 'This removes the contact, its messages and notes from the CRM. It can’t be undone.', okLabel: 'Delete contact', run: async () => {
    await host.deleteLead(l.id);
    S.leads = S.leads.filter((x) => String(x.id) !== String(l.id));
    S.total = Math.max(0, S.total - 1);
    toast(`Deleted ${l.name || 'lead'}`);
    if (S.leadId === String(l.id)) closeLead();
  } });
}
function startOnboarding(l) {
  if (l.onboarding && l.onboarding.unitId) { host.openOnboardingUnit && host.openOnboardingUnit(l.onboarding.unitId); return; }
  host.startOnboarding && host.startOnboarding(l.id);
}
async function createLead() {
  const n = S.nl; if (!n || n.busy) return;
  const clean = n.name.replace(/\s+/g, ' ').trim();
  if (!clean) { n.err = 'A name is required.'; renderOverlay(); return; }
  n.busy = true; n.err = ''; renderOverlay();
  try {
    const data = await host.createLead({ createLead: true, name: clean, phone: n.phone.trim(), email: n.email.trim(), address: n.address.trim(), source: n.source, referredBy: n.source === 'Referral' ? n.referredBy.trim() : '', notes: n.notes.trim() });
    if (!data || !data.lead || !data.lead.id) throw new Error((data && data.error) || 'Could not create the lead.');
    S.modal = null; S.nl = null; renderOverlay();
    mergeLead(data.lead.id, data.lead);
    S.total += 1;
    toast(`${data.lead.name || clean} added at New · AI paused`);
    openLead(data.lead.id);
    loadLeads();
  } catch (e) {
    n.busy = false; n.err = errMsg(e, 'Could not create the lead.'); renderOverlay();
  }
}

/* ---------------- knowledge actions ---------------- */
async function kUpload(file, input) {
  if (!file) return;
  setBusy('kUp', true);
  try {
    await host.knowledgeUpload({ file, title: S.kUp.title.trim() || file.name });
    S.kUp = { title: '', text: '' };
    toast(`Uploaded ${file.name}`);
    await loadDocs();
  } catch (e) {
    S.docsErr = errMsg(e, 'Upload failed');
  } finally {
    if (input) input.value = '';
    setBusy('kUp', false);
  }
}
async function kAddPaste() {
  const text = S.kUp.text.trim();
  if (!text) { toast('Paste some text first.', 'bad'); return; }
  setBusy('kUp', true);
  try {
    await host.knowledgeUpload({ text, title: S.kUp.title.trim() });
    S.kUp = { title: '', text: '' };
    if (S.modal && S.modal.kind === 'paste') { S.modal = null; renderOverlay(); }
    toast('Text added');
    await loadDocs();
  } catch (e) {
    S.docsErr = errMsg(e, 'Could not save text');
    if (S.modal) renderOverlay();
  } finally {
    setBusy('kUp', false);
  }
}
async function kOpen(id) {
  S.ed = { id, title: '', text: '', busy: false, err: '', loading: true };
  openModal({ kind: 'editor' });
  try {
    const data = await host.loadDoc(id);
    if (S.ed.id !== id) return;
    S.ed.title = (data.doc && data.doc.title) || ''; S.ed.text = data.text || '';
  } catch (e) {
    if (S.ed.id !== id) return;
    S.ed.err = errMsg(e, 'Could not open document');
  }
  S.ed.loading = false;
  if (S.modal && S.modal.kind === 'editor') renderOverlay();
}
async function kSave() {
  const e = S.ed;
  if (!e.id || !e.text.trim()) { e.err = 'The document needs some content.'; renderOverlay(); return; }
  e.busy = true; e.err = ''; renderOverlay();
  try {
    await host.knowledgePatch({ id: e.id, action: 'save_content', title: e.title, text: e.text });
    e.busy = false; S.modal = null; renderOverlay();
    toast('Document saved');
    await loadDocs();
  } catch (err) {
    e.busy = false; e.err = errMsg(err, 'Could not save document'); renderOverlay();
  }
}
async function kToggle(id) {
  const d = S.docs.find((x) => String(x.id) === String(id)); if (!d) return;
  d.active = !d.active; renderMain();
  try { await host.knowledgePatch({ id: d.id, active: d.active }); await loadDocs(); }
  catch (e) { d.active = !d.active; toast(errMsg(e, 'Could not update document'), 'bad'); renderMain(); }
}
async function kRetry(id) {
  setBusy('kUp', true);
  try { await host.knowledgePatch({ id, action: 'reindex' }); await loadDocs(); toast('Processing again'); }
  catch (e) { S.docsErr = errMsg(e, 'Reindex failed'); }
  finally { setBusy('kUp', false); }
}
function kDelete(id) {
  const d = S.docs.find((x) => String(x.id) === String(id)); if (!d) return;
  openModal({ kind: 'confirm', title: `Delete ${d.title || 'this document'}?`, lede: 'The AI stops using it right away. It can’t be undone.', okLabel: 'Delete', run: async () => {
    await host.knowledgeDelete(d.id);
    toast('Document deleted');
    await loadDocs();
  } });
}

/* ---------------- settings actions ---------------- */
async function patchSettings(body, busyKey, okMsg) {
  setBusy(busyKey, true);
  try {
    const data = await host.patchSettings(body);
    S.settings = { ...(S.settings || {}), ...(data || {}) };
    if (okMsg) toast(okMsg);
    return data;
  } catch (e) {
    toast(errMsg(e, 'Save failed'), 'bad');
    return null;
  } finally {
    setBusy(busyKey, false);
  }
}
async function saveOp() {
  const data = await patchSettings({ operator_callback_phone: S.set.op.trim() }, 'op');
  if (data) {
    S.set.op = String(data.operator_callback_phone ?? S.set.op).trim();
    S.settings.operator_callback_phone = S.set.op;
    S.set.opDirty = false; S.set.opMsg = 'Saved';
    setTimeout(() => { S.set.opMsg = ''; if (S.tab === 'settings') renderMain(); }, 1600);
    renderMain();
  }
}
async function notifyAdd(name, phone) {
  const data = await patchSettings({ action: 'add_notify_recipient', name, phone }, 'notify');
  if (data) { S.set.nName = ''; S.set.nPhone = ''; S.set.nMsg = data.welcome_sent ? 'Saved. Welcome text sent' : 'Saved'; renderMain(); }
}
async function createCode() {
  const data = await patchSettings({ action: 'create_unlock_code', code: S.set.uCode.trim(), label: S.set.uLabel.trim() }, 'unlock');
  if (data) { S.set.uMsg = `Created ${(data.code && data.code.code) || S.set.uCode.trim().toUpperCase()}. One-time use.`; S.set.uCode = ''; S.set.uLabel = ''; renderMain(); }
}
async function pastePreview() {
  setBusy('paste', true); S.set.pErr = ''; S.set.pMsg = '';
  try { S.set.preview = await host.previewPaste(S.set.paste); }
  catch (e) { S.set.preview = null; S.set.pErr = errMsg(e, 'Preview failed'); }
  finally { setBusy('paste', false); }
}
async function pasteImport() {
  setBusy('paste', true); S.set.pErr = ''; S.set.pMsg = '';
  try {
    const data = await host.importPaste(S.set.paste);
    const smsNote = (data.smsSentNow || 0) > 0
      ? (data.aiSkipped ? ` Safe intro SMS sent (AI issue logged on lead: ${data.aiSkipped}).` : ' AI first SMS sent.')
      : (data.decision && data.decision.qualifiesForBookEmail ? ` No customer SMS (${data.aiSkipped || 'AI off or Twilio missing'}).` : ' No SMS.');
    S.set.pMsg = `Saved ${(data.parsed && data.parsed.name) || 'lead'} as ${STATUS_LABEL[data.decision && data.decision.status] || (data.decision && data.decision.status) || 'New'}.${smsNote}`;
    S.set.paste = ''; S.set.preview = null;
    await loadLeads();
    if (data.leadId) openLead(data.leadId);
  } catch (e) {
    S.set.pErr = errMsg(e, 'Import failed');
  } finally {
    setBusy('paste', false);
  }
}

/* ---------------- Ctrl+K ---------------- */
function openCmdk() { S.cmd = { q: '', act: 0, items: [] }; openModal({ kind: 'cmdk' }, '[data-k="cmd.q"]'); }
function refreshCmd() { const r = $('#cmdRes'); if (r) r.innerHTML = cmdResults(); }
function runCmd(i) {
  const it = S.cmd.items[i]; if (!it) return;
  S.modal = null; renderOverlay();
  if (it.kind === 'lead') openLead(it.l.id);
  else if (it.a === 'newLead') openNewLead();
  else if (it.a.startsWith('tab:')) setTab(it.a.slice(4));
}

/* =========================================================
   Events
   ========================================================= */
function setPath(path, value) {
  const [a, b] = path.split('.');
  if (a === 'ld') { const l = leadById(S.leadId); if (l) D(l)[b] = value; return; }
  if (a === 'draftEdit') { if (S.draftEdit) S.draftEdit.text = value; return; }
  if (!b) { S[a] = value; return; }
  if (S[a]) S[a][b] = value;
}
const ACT = {
  sideTog: () => { root.classList.toggle('sb-collapsed'); lsSet('crm-sb', root.classList.contains('sb-collapsed') ? '1' : '0'); },
  newLead: () => openNewLead(),
  goSettings: () => setTab('settings'),
  closeModal: () => closeModal(),
  confirmOk: async () => {
    const m = S.modal; if (!m || m.busy) return;
    m.busy = true; renderOverlay();
    try { await m.run(); S.modal = null; renderOverlay(); render(); }
    catch (e) { m.busy = false; renderOverlay(); toast(errMsg(e, 'Delete failed'), 'bad'); }
  },
  needs: (b) => { S.f.needs = b.dataset.v === '1'; renderMain(); },
  bookedWeek: () => { S.f.booked = !S.f.booked; renderMain(); if (S.modal && S.modal.kind === 'filters') renderOverlay(); },
  fset: (b) => { S.f[b.dataset.f] = b.dataset.v; renderMain(); renderOverlay(); },
  filters: () => openModal({ kind: 'filters' }),
  clearFilters: () => {
    const hadQ = S.f.q.trim();
    S.f = { q: '', needs: false, path: 'all', stage: 'all', ai: 'all', booked: false, sort: 'inbox' };
    if (S.modal && S.modal.kind === 'filters') { S.modal = null; renderOverlay(); }
    renderMain(); if (hadQ) loadLeads();
  },
  showAll: () => { S.f.needs = false; renderMain(); },
  refresh: () => { loadLeads(); if (S.leadId) loadThread(S.leadId); },
  open: (b) => openLead(b.dataset.id),
  rowMenu: (b) => { if (S.menu && S.menu.id === b.dataset.id && S.menu.kind === 'row') { S.menu = null; renderMenu(); return; } openMenu('row', b.dataset.id, b); },
  leadMenu: (b) => { if (S.menu && S.menu.kind === 'lead') { S.menu = null; renderMenu(); return; } openMenu('lead', S.leadId, b); },
  closeLead: () => closeLead(),
  ptab: (b) => { S.ptab = b.dataset.v; renderMain(); },
  aiTakeOver: () => patchLead({ aiPaused: true }, 'AI paused for this chat'),
  aiResume: () => patchLead({ aiPaused: false }, 'AI resumed'),
  aiEnable: () => patchLead({ aiForceOn: true }, 'AI on for this lead'),
  sendMode: (b) => { const l = leadById(S.leadId); if (!l || l.ai_send_mode === b.dataset.v) return; mergeLead(l.id, { ai_send_mode: b.dataset.v }); patchLead({ aiSendMode: b.dataset.v }, b.dataset.v === 'draft' ? 'AI drafts for review' : 'Autopilot on'); },
  aiFirst: () => { const l = leadById(S.leadId); if (!l) return; setBusy('save', true);
    host.aiSendFirst(l.id).then((data) => { applyLeadResponse(l.id, data); toast(data && data.pending_draft ? 'AI first message drafted' : 'AI first message sent'); })
      .catch((e) => toast(errMsg(e, 'AI did not send the first SMS.'), 'bad')).finally(() => setBusy('save', false)); },
  followUp: () => { const l = leadById(S.leadId); if (!l) return; setBusy('save', true);
    host.aiNudge(l.id).then((data) => { applyLeadResponse(l.id, data); toast(data && data.pending_draft ? 'Follow-up drafted' : 'Follow-up sent'); })
      .catch((e) => toast(errMsg(e, 'Could not follow up.'), 'bad')).finally(() => setBusy('save', false)); },
  fupDone: () => { const last = S.th.messages[S.th.messages.length - 1]; if (last) S.fupDone[last.id || last.created_at] = true; renderMain(); },
  draftApprove: () => draftAct('approve'),
  draftDiscard: () => draftAct('discard'),
  draftSave: () => draftAct('save'),
  draftEdit: () => { if (S.th.draft) { S.draftEdit = { id: S.th.draft.id, text: S.th.draft.body }; renderMain(); const t = root.querySelector('[data-k="draftEdit.text"]'); if (t) t.focus(); } },
  draftCancel: () => { S.draftEdit = null; renderMain(); },
  sendSms: () => sendSms(),
  editPhone: () => { const l = leadById(S.leadId); S.phoneEdit = l && phoneUsable(l.phone) ? fmtPhone(l.phone) : ''; S.ptab = 'details'; renderMain(); const t = root.querySelector('[data-k="phoneEdit"]'); if (t) t.focus(); },
  cancelPhone: () => { S.phoneEdit = null; renderMain(); },
  savePhone: async () => { const v = String(S.phoneEdit || '').trim(); if (!v) { toast('Enter a phone number.', 'bad'); return; } const data = await patchLead({ phone: v }, 'Phone saved'); if (data) { S.phoneEdit = null; renderMain(); } },
  copyPhone: (b) => { const l = leadById(b.dataset.id || S.leadId); if (l && l.phone) copyText(fmtPhone(l.phone), 'Phone'); S.menu = null; renderMenu(); },
  crmCall: () => crmCall(),
  saveNotes: () => { const l = leadById(S.leadId); if (l) runSave('notes', D(l).notes); },
  pbComplete: () => patchLead({ playbookAction: 'complete' }, 'Step completed').then(() => undefined),
  pbSkip: () => patchLead({ playbookAction: 'skip' }, 'Step skipped').then(() => undefined),
  startOnboarding: () => { const l = leadById(S.leadId); if (l) startOnboarding(l); },
  openUnit: (b) => { const l = leadById(b.dataset.id || S.leadId); if (l && l.onboarding) host.openOnboardingUnit && host.openOnboardingUnit(l.onboarding.unitId); },
  convertClient: (b) => { const l = leadById(b.dataset.id || S.leadId); S.menu = null; renderMenu(); if (l && host.convertLeadToOpsClient) host.convertLeadToOpsClient({ id: l.id, name: l.name, email: l.email, phone: l.phone }); },
  markBooked: (b) => { const id = b.dataset.id || S.leadId; S.menu = null; renderMenu(); if (id) markBooked(id); },
  askDelete: (b) => askDelete(b.dataset.id || S.leadId),
  kEdit: (b) => kOpen(b.dataset.id),
  kAddPaste: () => kAddPaste(),
  kPasteSheet: () => openModal({ kind: 'paste' }, '#psT'),
  kToggle: (b) => kToggle(b.dataset.id),
  kRetry: (b) => kRetry(b.dataset.id),
  kDelete: (b) => kDelete(b.dataset.id),
  edSave: () => kSave(),
  toggleAuto: () => patchSettings({ ai_responses_enabled: !(S.settings && S.settings.ai_responses_enabled) }, 'globalAi', null),
  saveOp: () => saveOp(),
  notifyToggle: () => patchSettings({ lead_notify_sms_enabled: !(S.settings && S.settings.lead_notify_sms_enabled) }, 'notify', 'Saved'),
  notifyAdd: () => notifyAdd(S.set.nName, S.set.nPhone),
  notifyVerify: (b) => { S.set.nPhone = b.dataset.phone || ''; S.set.nName = b.dataset.name || ''; S.set.nMsg = 'Add a name, then press Add person to verify.'; renderMain(); const t = root.querySelector('[data-k="set.nName"]'); if (t) t.focus(); },
  notifyRemove: (b) => patchSettings({ action: 'remove_notify_recipient', id: b.dataset.id }, 'notify', 'Removed'),
  createCode: () => createCode(),
  copyCode: (b) => copyText(b.dataset.code, 'Code'),
  pastePreview: () => pastePreview(),
  pasteImport: () => pasteImport(),
  logout: () => { if (host.logout) Promise.resolve(host.logout()).catch((e) => toast(errMsg(e, 'Log out failed'), 'bad')); },
};

function onClick(e) {
  const t = e.target;
  if (S.menu && !t.closest('.menu') && !t.closest('[data-act="rowMenu"],[data-act="leadMenu"]')) { S.menu = null; renderMenu(); }
  const ci = t.closest('[data-ci]'); if (ci) { runCmd(+ci.dataset.ci); return; }
  const nav = t.closest('[data-nav]'); if (nav) { setNav(nav.dataset.nav); return; }
  const tab = t.closest('[data-tab]'); if (tab) { setTab(tab.dataset.tab); return; }
  if (t.closest('[data-cmdk]')) { openCmdk(); return; }
  const a = t.closest('[data-act]');
  if (a) { if (a.disabled) return; const fn = ACT[a.dataset.act]; if (fn) { e.preventDefault(); fn(a, e); } return; }
  const row = t.closest('[data-open]');
  if (row) openLead(row.dataset.open);
}
function onInput(e) {
  const t = e.target, k = t.dataset && t.dataset.k;
  if (!k) return;
  setPath(k, t.value);
  if (k === 'f.q') { clearTimeout(qT); qT = setTimeout(() => loadLeads(), 250); return; }
  if (k === 'sms') {
    ssSet(`mrg_sms_${S.leadId}`, t.value);
    const b = root.querySelector('.sendbtn'); const l = leadById(S.leadId);
    if (b) b.classList.toggle('off', !(t.value.trim() && l && phoneUsable(l.phone)));
    sizeComposer();
    return;
  }
  if (k === 'nl.name' || k === 'nl.phone') {
    const h = nlHints();
    const hn = root.querySelector('[data-hint="name"]'), hp = root.querySelector('[data-hint="phone"]');
    if (hn) { hn.innerHTML = h.name; hn.className = `hint ${h.nameCls}`; }
    if (hp) { hp.innerHTML = h.phone; hp.className = `hint ${h.phoneCls}`; }
    const sv = root.querySelector('#nlSave'); if (sv) sv.disabled = Boolean(S.nl.busy) || !S.nl.name.trim();
    return;
  }
  if (k === 'cmd.q') { S.cmd.act = 0; refreshCmd(); return; }
  if (k === 'set.op') { S.set.opDirty = true; const b = root.querySelector('[data-act="saveOp"]'); if (b) b.disabled = isBusy('op') || t.value.trim() === callbackPhone(); return; }
  if (k === 'set.paste') { root.querySelectorAll('[data-act="pastePreview"],[data-act="pasteImport"]').forEach((b) => { b.disabled = isBusy('paste') || !t.value.trim(); }); return; }
  if (k === 'set.nPhone') { const b = root.querySelector('[data-act="notifyAdd"]'); if (b) b.disabled = isBusy('notify') || !t.value.trim(); return; }
  if (k === 'set.uCode') { const b = root.querySelector('[data-act="createCode"]'); if (b) b.disabled = isBusy('unlock') || t.value.trim().length < 4; return; }
}
function onChange(e) {
  const t = e.target;
  if (t.dataset.sel) {
    const k = t.dataset.sel, v = t.value;
    if (k.startsWith('f.')) { S.f[k.slice(2)] = v; renderMain(); if (S.modal && S.modal.kind === 'filters') renderOverlay(); return; }
    if (k === 'nl.source') { S.nl.source = v; keepFocus(renderOverlay); return; }
    const l = leadById(S.leadId); if (!l) return;
    if (k === 'status') patchLead({ status: v }, `Stage set to ${STATUS_LABEL[v] || v}`);
    else if (k === 'offerPath') patchLead({ offerPath: v }, `Path set to ${OFFER_PATH_LABEL[v] || v}`);
    else if (k === 'plan') patchLead({ plan: v }, 'Plan saved');
    else if (k === 'contractStatus') patchLead({ contractStatus: v }, 'Contract saved');
    return;
  }
  if (t.dataset.save) { runSave(t.dataset.save, t.value); return; }
  if (t.dataset.file) { const f = t.files && t.files[0]; if (f) kUpload(f, t); }
}
function onKey(e) {
  const t = e.target;
  if (e.key === 'Escape') {
    if (S.menu) { S.menu = null; renderMenu(); return; }
    if (S.modal) { closeModal(); return; }
    if (S.phoneEdit != null) { S.phoneEdit = null; renderMain(); return; }
  }
  if (t.dataset && t.dataset.k === 'cmd.q') {
    const n = S.cmd.items.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); S.cmd.act = n ? (S.cmd.act + 1) % n : 0; refreshCmd(); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); S.cmd.act = n ? (S.cmd.act - 1 + n) % n : 0; refreshCmd(); return; }
    if (e.key === 'Enter') { e.preventDefault(); runCmd(S.cmd.act); return; }
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && S.th.draft && S.leadId && !isBusy('save')) { e.preventDefault(); draftAct('approve'); return; }
  if (t.dataset && t.dataset.k === 'sms' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendSms(); return; }
  if (t.dataset && t.dataset.k === 'phoneEdit' && e.key === 'Enter') { e.preventDefault(); ACT.savePhone(); return; }
  if (e.key === 'Enter' && t.matches && t.matches('[data-open]')) { e.preventDefault(); openLead(t.dataset.open); }
}
function onSubmit(e) { if (e.target.id === 'nlForm') { e.preventDefault(); createLead(); } }
function onScrimDown(e) { if (e.target.id === 'scrim') closeModal(); }
function onDocKey(e) {
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); if (S.modal && S.modal.kind === 'cmdk') closeModal(); else openCmdk(); }
}
function onResize() { if (S.menu) { S.menu = null; renderMenu(); } }

let qT = 0;
root.addEventListener('click', onClick);
root.addEventListener('input', onInput);
root.addEventListener('change', onChange);
root.addEventListener('keydown', onKey);
root.addEventListener('submit', onSubmit);
root.addEventListener('mousedown', onScrimDown);
document.addEventListener('keydown', onDocKey);
window.addEventListener('resize', onResize);

/* =========================================================
   Start: route, first load, live poll every 12s
   ========================================================= */
const r0 = (host.getRoute && host.getRoute()) || {};
S.tab = r0.tab || 'contacts';
render();
loadLeads();
loadSettings();
if (S.tab === 'knowledge') loadDocs();
if (S.tab === 'contacts' && r0.leadId) openLead(r0.leadId, { noRoute: true });
if (r0.newLead) openNewLead();

const poll = setInterval(() => {
  if (document.hidden) return;
  const a = shadow.activeElement;
  if (a && a.tagName === 'SELECT') return;
  loadLeads();
  if (S.leadId) loadThread(S.leadId);
  if (S.tab === 'knowledge') loadDocs();
}, 12000);
const tick = setInterval(() => { if (S.tab === 'contacts' && !S.leadId && !S.refreshing) { const m = root.querySelector('.listhead .lhr .meta'); if (m) m.textContent = updatedLabel(); } }, 30000);

return {
  destroy() {
    clearInterval(poll); clearInterval(tick); clearTimeout(qT); clearTimeout(toastT);
    document.removeEventListener('keydown', onDocKey);
    window.removeEventListener('resize', onResize);
    root.innerHTML = '';
  },
  openLead: (id) => openLead(id),
  openNewLead: () => openNewLead(),
  applyRoute,
};
}
