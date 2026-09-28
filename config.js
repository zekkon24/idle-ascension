/* Idle Ascension · configuración de equilibrio.
   Todos los números del juego viven aquí. Lo usan el motor (engine.js) y la interfaz (ui.js). */
(function(root){
const CFG = {
  classes: {
    Guerrero:{hp:192.76,ghp:1.6193,atk:19.82,gatk:0.2663,df:12.35,gdf:0.1049,spd:0.8,cr:0,cd:1.0,ev:0,ranged:false,color:'#d9774a',p:{dmgTaken:0.95},
      passive:'Piel dura: recibe un 5 % menos de daño', role:'Tanque · cuerpo a cuerpo'},
    Mago:{hp:138.82,ghp:1.0977,atk:27.22,gatk:0.2774,df:4.12,gdf:0.035,spd:0.7,cr:0,cd:1.0,ev:0,ranged:true,color:'#8f7cf0',p:{xp:1.1},
      passive:'Erudito: +10 % de experiencia', role:'Daño · a distancia'},
    Arquero:{hp:131.06,ghp:1.1558,atk:13.82,gatk:0.1101,df:5.15,gdf:0.0437,spd:1.3,cr:0.05,cd:1.0,ev:0.05,ranged:true,color:'#5fb86a',p:{spd:1.05},
      passive:'Pulso firme: +5 % de velocidad de ataque', role:'Daño · a distancia'},
    Asesino:{hp:142.29,ghp:0.9114,atk:18.43,gatk:0.1648,df:4.12,gdf:0.035,spd:1.0,cr:0.10,cd:1.0,ev:0.15,ranged:false,color:'#c95a8a',p:{cd:0.5},
      passive:'Letal: +50 % de daño crítico', role:'Daño · cuerpo a cuerpo'},
    Clerigo:{hp:228.46,ghp:1.4863,atk:18.11,gatk:0.2622,df:8.23,gdf:0.0699,spd:0.8,cr:0,cd:1.0,ev:0,ranged:true,color:'#e9c75a',p:{regen:0.005},
      passive:'Fe: regenera el 0,5 % de su vida por segundo', role:'Tanque · a distancia', label:'Clérigo'},
  },
  enemy:{hp:45,hpG:1.0358,atk:6,atkG:1.026,earlyTo:50,hpG0:1.035,atkG0:1.024, // hasta la fase 50 crecen con hpG0/atkG0
         hpBands:[[101,1.051,1.036]], // de la fase 101 a la 150 los enemigos crecen más: la fase 150 llega hacia el día 13
         walls:{50:{hp:5.74,atk:2.71},100:{hp:2.5,atk:1.95},150:{hp:1.7,atk:1.55}}, // jefes de élite de Normal con valores propios (misma escala que eliteHp/eliteAtk)
         df:3,dfG:1.0119,waveHp:0.0145,
         bossHp:1.5,bossAtk:1.5,   // (respaldo: bossBands manda) jefe cada 10 fases: vida en oleadas (1 = toda la oleada de su fase), ataque en enemigos (1 = un enemigo)
         bossBands:[[1,1.5,1.5],[51,2.0,1.7],[101,1.7,1.6],[151,1.6,1.55]], // [desde fase, vida, ataque]: los jefes normales frenan unas horas en cada tramo
         eliteHp:3,eliteAtk:2,     // (respaldo: walls manda) jefe de élite cada 50 fases (mismas unidades)
         extraEvery:50,spd:0.8,walk:2.0,
         // Números pequeños: el ataque enemigo baja lo mismo que la vida y la defensa del héroe, × (1,008 / 1,0226)^u,
         // con u = nivel medio de mejoras de Vida/Defensa con que se vence cada fase (medido con simulaciones). [fase, u]
         atkShrink:[[1,0],[10,0],[20,8],[30,14],[40,23],[49,31],[50,59],[60,60],[70,64],[80,69],[90,77],[100,93],[110,100],[120,115],[130,128],[140,142],[150,151]]},
  econ:{gold:0.45,goldG:1.0198,bossGold:10,xp:4,xpG:1.0389,xpReq:1300,xpReqG:1.077, xpBands:[[101,1.0,0.06],[151,1.05,1]], // nivel 100 hacia el día 8-9; xpBands: [desde nivel, crecimiento] para niveles altos
       bossScrap:{base:4,per10:2,farm:10}}, // chatarra por jefe: 4 + 2 cada 10 fases (jefe de la 150 repetido: 10), × (modo+1)
  upgrades:{ // coste ×1,031 por nivel (antes ×1,0325): compensa el calendario que ya no existe
    atk:{name:'Daño',base:25,g:1.031,mult:1.0226},
    hp:{name:'Vida',base:25,g:1.031,mult:1.008,ref:1.0226}, // números pequeños: +0,8 % por nivel (antes +2,26 %: ref)
    df:{name:'Defensa',base:25,g:1.031,mult:1.008,ref:1.0226},
    spd:{name:'Velocidad de ataque',base:5,g:1.031,mult:1.004}, // +0,4 % por nivel; más barata para que rinda como las demás
  },
  rar:['C','U','R','E','L','M'],
  rarName:{C:'Común',U:'Poco común',R:'Rara',E:'Épica',L:'Legendaria',M:'Mítica'},
  weapon:{ // daño%, velocidad%, nº stats
    C:[0.06,0.02,1],U:[0.11,0.036,2],R:[0.20,0.065,2],E:[0.36,0.12,3],L:[0.65,0.21,3],M:[1.15,0.37,4],
    lvlPct:0.25,maxLvl:5, // nv5 = ×2 del base: una nv5 supera un poco a la siguiente rareza nv1; nivel N -> N+1 cuesta N armas iguales + chatarra
    scrapLvl:{C:0,U:10,R:30,E:60,L:120,M:240},
    scrapDis:{C:2,U:5,R:15,E:40,L:100,M:250},
    refund:0.6,
    reforge:{C:3,U:5,R:10,E:20,L:40,M:80},reforgeStep:0.2,reforgeCap:3, // coste = base × (1 + 0,2 por reforja hecha), como mucho ×3
  },
  sec:{
    hpp:{n:'Vida',C:[3,6],U:[5,8],R:[8,12],E:[10,15],L:[15,20],M:[20,26]},
    dfp:{n:'Defensa',C:[3,6],U:[5,8],R:[8,12],E:[10,15],L:[15,20],M:[20,26]},
    cr:{n:'Crítico',C:[2,4],U:[3,5],R:[5,8],E:[7,10],L:[10,14],M:[14,18]},
    cd:{n:'Daño crítico',C:[10,20],U:[15,25],R:[25,40],E:[35,50],L:[50,70],M:[70,90]},
    ls:{n:'Robo de vida',C:[1,2],U:[2,3],R:[3,4.5],E:[4,6],L:[6,8],M:[8,10]},
    bd:{n:'Daño a jefes',C:[5,10],U:[8,12],R:[12,18],E:[15,25],L:[25,35],M:[35,45]},
  },
  caps:{cr:0.5,ls:0.2},
  names:{
    Guerrero:['Espada oxidada','Espada de acero','Hoja del capitán','Mandoble rúnico','Hacha del Titán','Espada del Primer Rey'],
    Mago:['Varita de sauce','Bastón de roble','Báculo de cristal','Cetro arcano','Báculo del Eclipse','Bastón del Origen'],
    Arquero:['Arco corto','Arco largo','Arco élfico','Arco de viento','Arco Tormenta','Arco Celestial'],
    Asesino:['Dagas melladas','Dagas de acero','Colmillos gemelos','Dagas sombrías','Dagas del Vacío','Dagas del Fin'],
    Clerigo:['Maza de madera','Maza de hierro','Maza bendita','Martillo sagrado','Maza Solar','Maza del Alba'],
  },
  // Cofres: % por MODO (Normal en dos tramos, Pesadilla, Infierno) → [% Común, Poco común, Rara, Épica, Legendaria, Mítica].
  // Los % NO se escriben a mano: salen de las fórmulas de CHEST_PLAN (abajo del todo). Cada cofre da 1 arma.
  chests:{
    wood:{name:'Madera',from:'Jefes y eventos'},
    silver:{name:'Plata',from:'Tienda (oro)',goldMin:5,perDay:10}, // precio: el oro de 5 min farmeando tu récord; como mucho 10 al día
    mode:{name:'Modo',from:'Tienda',price:100}, // 100 tokens (1 $)
  },
  // Tokens = dinero: 100 tokens = 1 $. Dos saldos: comprados (no se retiran) y ganados en los pools (se pueden retirar).
  // Al gastar se usan primero los comprados. Compras y retiros SIMULADOS hasta que haya servidor y pasarela de pago.
  // open: se pueden comprar tokens (poner a true al conectar Telegram Stars); mientras, lo que se paga con tokens sale "Próximamente"
  tokens:{perUsd:100, open:false, packs:[100,500,1000,2500], withdraw:{fee:0.15, min:100}}, // retiro: comisión 15 %, mínimo 100 (1 $)
  startWeapon:'C',
  // Grimorios: 2 por clase; se desbloquean donando oro (horas de farmeo de tu récord), esencias y emblemas, o se compran con tokens.
  // El 2.º cuesta el doble. Suben de nivel contigo (nivel 1 al desbloquearlo). En el nivel 'skillLvl' dan su efecto
  // (POR AHORA SIN EFECTO: solo existen). Solo uno activo; cambiarlo cuesta switchCost tokens.
  grimoire:{skillLvl:25, switchCost:250, cost:[{goldH:2,ess:2,ev:4},{goldH:4,ess:4,ev:8}], pack:[300,600],
    classes:{
      Guerrero:[{id:'espinas',name:'Grimorio de Espinas',role:'Castigador',desc:'Devuelve el 40 % del daño que recibe al que le pega'},
                {id:'trueno',name:'Grimorio del Trueno',role:'Limpiador',desc:'Cada 4.º golpe lanza un rayo que salta a 2 enemigos más'}],
      Mago:[{id:'invocador',name:'Grimorio del Invocador',role:'Invocador',desc:'Cada 20 s invoca un esqueleto 8 s que pega por él y se lleva los golpes'},
            {id:'hielo',name:'Grimorio de Hielo',role:'Control',desc:'Sus golpes ralentizan: los enemigos atacan un 30 % más despacio'}],
      Arquero:[{id:'plaga',name:'Grimorio de la Plaga',role:'Contagio',desc:'Sus flechas envenenan; al morir, el enemigo pasa el veneno al siguiente'},
               {id:'viento',name:'Grimorio del Viento',role:'Kiting',desc:'Cada 15 s empuja a los enemigos atrás: tienen que volver a caminar'}],
      Asesino:[{id:'almas',name:'Grimorio de las Almas',role:'Bola de nieve',desc:'Cada enemigo que mata le da +3 % de daño hasta acabar la oleada (máx. +30 %)'},
               {id:'sangre',name:'Grimorio de Sangre',role:'Duelista',desc:'Sus críticos hacen sangrar 3 s y roban vida'}],
      Clerigo:[{id:'tiempo',name:'Grimorio del Tiempo',role:'Segunda oportunidad',desc:'Una vez por combate, al morir retrocede 5 s y revive con la vida que tenía'},
               {id:'juicio',name:'Grimorio del Juicio',role:'Paladín',desc:'Cuanta más vida tiene, más daño hace (hasta +50 % con la vida llena)'}],
    }},
  matShop:{ess:50, ev:25}, // tienda: Esencia 50 tokens, Emblema 25 tokens
  boosts:{ // potenciadores por anuncios (cada uso pide 'ads' anuncios; 'perDay' usos al día)
    speed:{ads:2,min:15,mult:2,perDay:3}, // combate ×2 durante 15 min reales (se acumula si ya está activo)
    gold:{ads:2,hours:1,earlyHours:0.5,earlyUntil:50,perDay:3}, // oro de 1 h farmeando tu fase récord (30 min hasta pasar la fase 50)
  },
  evo:{ // evoluciones: al llegar al nivel de cada una se gana su pasiva y el nivel sigue (hasta evolucionar, ese nivel es el tope)
    tiers:[
      {lvl:150, cost:{ess:3,gold:10000,ev:12}, bonus:{hp:0.15,atk:0.15}, classes:{ // cost: esencias del modo Normal + oro + material del evento · bonus: extra de vida y daño
        Guerrero:{name:'Berserker',passive:'Furia: +1 % de daño por cada golpe recibido en la oleada (máx. +25 %)',rage:0.01,rageCap:0.25},
        Mago:{name:'Archimago',passive:'Fuego: cada golpe quema al enemigo; la quemadura se acumula hasta 5 veces',burnPct:0.08,burnDur:3,burnMax:5},
        Arquero:{name:'Tirador',passive:'Disparo doble: 20 % de probabilidad de disparar dos veces',double:0.2},
        Asesino:{name:'Sombra',passive:'Instinto: tras un crítico, el siguiente golpe hace +100 % de daño',critNext:1.0},
        Clerigo:{name:'Oráculo',passive:'Luz interior: al bajar del 50 % de vida, la regeneración se triplica 10 s (1 vez por oleada)',lightHp:0.5,lightMult:3,lightDur:10},
      }},
      // Evolución 2: mejora la pasiva de clase (base) y añade un efecto nuevo; se suma a la pasiva de la evolución 1
      {lvl:300, pending:true, cost:{ess:5,gold:400000,ev:30}, // pending: bloqueada ("próximamente"), pide Esencia de pesadilla
       bonus:{hp:0.15,atk:0.15}, classes:{
        Guerrero:{name:'Titán',base:{dmgTaken:0.925},rageCap:0.40,defDmg:1.0,passive:'Piel dura: −7,5 % de daño recibido · Furia hasta +40 % · Sus golpes suman un 100 % de su defensa como daño'},
        Mago:{name:'Hechicero del Vacío',base:{xp:1.15},burnPct:0.2,burnDur:4,burnMax:6,passive:'Erudito: +15 % de experiencia · La quemadura ignora la defensa, dura 4 s, quema más fuerte y se acumula hasta 6 veces'},
        Arquero:{name:'Ojo de Halcón',base:{spd:1.075},dblBuff:0.05,dblDur:5,dblMax:5,passive:'Pulso firme: +7,5 % de velocidad · Cada disparo doble da +5 % de daño durante 5 s (hasta +25 %)'},
        Asesino:{name:'Segador',base:{cd:0.5,cr:0.10},critStack:0.05,critStackMax:0.05,passive:'Letal: +50 % de daño crítico y +10 % de crítico · Tras un golpe sin crítico, el siguiente tiene +5 % de crítico'},
        Clerigo:{name:'Santo',base:{regen:0.0075},aura:13,auraDur:5,passive:'Fe: regenera el 0,75 % de su vida por segundo · Aura sagrada: lo que se cura se convierte en daño en área durante 5 s'},
      }},
    ],
  },
  matDrop:{from:10,to:150,c0:0.01,c1:0.05,max0:1,max1:3,sure:[50,100]}, // sure: esos jefes de élite dan 1 esencia segura la primera vez (para el Grimorio) // todos los jefes sueltan esencia del modo: 1 % (1) en la fase 10 → 5 % (1-3) en la 150 (el de la 150 se puede farmear)
  event:{ // Mazmorra (diaria): 3 min de monstruos sin parar; ranking por muertes; 1 entrada gratis al día, las demás con ticket
    dur:180, spawnEvery:1.2, walk:0.6, group:3, groupHp:2, groupGap:0.3, groupAtk:0.9, // grupos de 3 monstruos con ×2 de vida; llegan cada 0,3 s y pegan un 10 % menos
    ticketCost:100, // ticket extra en la tienda (tokens); las muertes de varios intentos del día se suman
    mat:'Emblema', pauseH:1, // pausa de 00:00 a 01:00 UTC: se terminan los intentos a medias y a la 01:00 se reparten los premios
    rivals:99, spread:0.35, rivalExtra:[0.2,0.06], rivalBase:0.84, // prob. de que un rival haga un 2º y un 3er intento; rivalBase ajusta la curva para que el jugador medio quede hacia el puesto 50
                          // rivales simulados: jugador medio de tus mismos días × dispersión
    curve:[[1,1],[2,6],[3,38],[5,119],[7,170],[10,219],[13,263],[15,290],[17,336],[20,369],[25,406],[30,421]], // [días de juego, muertes del jugador medio] (simulaciones F2P; después sigue la última pendiente)
    rewards:[                                     // premio según tu puesto del día (se cobra al día siguiente)
      {to:1,em:5,ch:'mode',n:1},{to:3,em:4,ch:'mode',n:1},{to:10,em:3,ch:'silver',n:2},
      {to:25,em:2,ch:'silver',n:1},{to:50,em:1,ch:'wood',n:2},{to:100,em:1,ch:'wood',n:1}],
  },
  wboss:{ // Jefe semanal: 1 min contra un jefe inmortal; ranking semanal por daño (se suman los intentos); 1 entrada gratis a la semana, las demás con Ticket Jefe
    dur:60, rampTo:300, atkMult:2,                // golpea como un jefe de la fase n (n sube de 1 a rampTo durante el minuto) × atkMult
    ticketCost:150,                               // Ticket Jefe en la tienda: 150 tokens
    rivals:99, spread:0.4, rivalExtra:[0.15,0.05], rivalBase:0.75, // rivales medidos a mitad de semana; así el jugador medio queda hacia el puesto 50
    curve:[[1,1200],[2,3800],[3,8700],[5,20700],[7,38100],[10,73200],[13,140300],[15,236300],[17,446900],[20,771400],[25,1585100],[30,2680400],[35,4049100],[40,5815200],[45,7649300]], // [días de juego, daño del jugador medio en una pelea] (simulaciones F2P, 4 semillas × 5 clases)
    rewards:[                                     // premio según tu puesto de la semana (lunes 01:00 UTC)
      // ×3 del premio diario de la Mazmorra en el mismo puesto (solo hay uno por semana); los cofres de madera
      // se cambian por plata de valor parecido (2 de madera ≈ 1 de plata) para que el premio luzca
      {to:1,em:15,ch:'mode',n:3},{to:3,em:12,ch:'mode',n:3},{to:10,em:9,ch:'silver',n:6},
      {to:25,em:6,ch:'silver',n:3},{to:50,em:3,ch:'silver',n:3},{to:100,em:3,ch:'silver',n:2}],
  },
  // buyPct 0: el % de las compras del amigo está desactivado hasta tener pagos reales (lo da el servidor)
  referral:{link:'https://t.me/IdleAscensionTestBot/game', goalFase:50, goalSilver:3, buyPct:0, giftSilver:1}, // enlace de la mini app (t.me/<bot>/<app>); premios (los da el servidor: supabase/functions/track)
  // Liga mensual (SIMULADA: sin dinero real). Bote = 70 % de todos los tokens gastados en el mes. Se reparte entre TODOS los
  // jugadores según sus puntos del mes: 1 por token gastado, 1 por anuncio visto (≈3× lo que genera: ~0,3 tokens) y
  // 0,5 por hora de oro generado (oro ÷ lo que da 1 h farmeando tu récord). Premio en tokens ganados (retirables), el día 1 a la 01:00 UTC.
  // Mientras no haya servidor: 99 rivales que gastan rivalSpend tokens/día y juegan rivalPlay puntos/día (14 anuncios + ~14 h de oro).
  // show:false = Liga oculta por ahora (se implementará aparte); los puntos se siguen contando
  league:{show:false, share:0.7, ptsToken:1, ptsAd:1, ptsGoldHour:0.5, rivals:99, rivalSpend:50, rivalPlay:21},
  // Mantenimiento y actualizaciones obligatorias (control.js): la versión se mira en GitHub cada 'every' s; el mantenimiento, al abrir/volver a la app y, con la clave pública, al instante
  control:{every:300, maintEvery:15},
  supabase:{url:'https://xdtxdaywotkppzssrjni.supabase.co', key:'sb_publishable_60pnk9ALWaV_ks2oAJ7TnA_IFHSG5qH'}, // key: clave pública (publishable/anon) para el aviso en directo
  server:{url:'https://xdtxdaywotkppzssrjni.supabase.co/functions/v1/track', every:10, saveEvery:120}, // saveEvery: subir la partida cada 2 min (lleva los eventos) // base de datos: dirección de la función "track" de Supabase (vacía = no se envía nada); envía como mucho cada 10 s
  devTools:false, // herramientas de prueba (velocidad, +oro, avanzar día…): poner a false al publicar en Telegram
  phaseCap:150, // cada modo tiene 150 fases; tras vencer la 150 y evolucionar se pasa al siguiente modo
  modes:[ // upPer: mejoras de Vida/Defensa que gana de media el jugador por fase en ese modo (números pequeños: baja el ataque enemigo; estimado, recalibrar al desbloquear)
          // locked: modo bloqueado ("Próximamente"): no se puede entrar aunque se cumplan los requisitos
          // enemigos: empiezan en los de la fase 150 del modo anterior × hpStart/atkStart y crecen hpG/atkG por fase · off: oro, experiencia y cofres continúan desde la fase off · gold: multiplicador de oro · mat: material propio (uso por definir)
    {name:'Normal',off:0,gold:1,mat:'Esencia'},
    {name:'Pesadilla',locked:true,off:149,gold:1.5,mat:'Esencia de pesadilla',hpStart:2.2,atkStart:1.6,hpG:1.019,atkG:1.013,upPer:0.5,
      walls:{50:{hp:2.5,atk:1.95},100:{hp:2.3,atk:1.8},150:{hp:2.1,atk:1.7}}},
    {name:'Infierno',locked:true,off:298,gold:2.25,mat:'Esencia infernal',hpStart:2.2,atkStart:1.6,hpG:1.019,atkG:1.013,upPer:0.5,
      walls:{50:{hp:2.5,atk:1.95},100:{hp:2.3,atk:1.8},150:{hp:2.1,atk:1.7}}},
  ],
  delays:{wave:0.25,fase:0.4,defeat:0.7}, // segundos de juego entre oleadas / fases / tras perder
  offlineMinMeasure:30, // sin conexión: se usa el DPS medido cuando ya se han medido ataques por valor de 30 golpes de tu daño
  offlineCapH:3, offlineVipH:8, offlineAdMult:1.5, offlineAdPerDay:2, // horas de farmeo sin conexión (VIP); extra de oro con anuncio al llenar el tope, 2 veces por día
  cardGold:0.2, cardPrice:500, vipSpeed:1.5, vipPrice:1000, // Tarjeta mensual (+20 % de oro) y VIP (combate ×1,5, 8 h sin conexión), 30 días, en tokens
};
/* ---------- Fórmulas de los cofres ----------
   PROGRESIÓN (madera y plata, jugador sin pagar). En cada tramo hay una rareza objetivo T que hay que subir de nv1 a nv5:
   eso son 11 armas de TU clase (1 + 1+2+3+4 para forjar). Solo 1 de cada 5 armas es de tu clase.
     armas propias de T al día = η · 1/5 · (plata/día + ρ · madera/día) · p_T
     → p_T(plata) = 11 / (η · 1/5 · días · (plata/día + ρ · madera/día))        p_T(madera) = ρ · p_T(plata)
   'días' = en cuántos días debe completarse T nv5 dentro del tramo. η = aprovechamiento real de las copias (medido: 0,9).
   Suerte: probabilidad de ver al menos 1 arma propia de la rareza SIGUIENTE en el tramo → p_T+1 = −ln(1 − suerte) / (1/5 · días · (S + ρ·W)).
   El resto va a la rareza anterior (se desmonta para chatarra). Los cofres/día salen de las simulaciones (jugador medio, 4 sesiones).
   ECONOMÍA (cofre de modo, de pago). El valor de un arma se mide en 'copias de T': la siguiente rareza nv1 ≈ T nv5 = 11 copias,
   así que valor(T+k) = 11^k. Valor de un cofre de plata = Σ p · 11^k. El cofre de modo debe valer lo mismo en todos los modos:
   'itemSCE' cofres de plata por arma. Una rareza de reparto fija (fixed), la principal (main) se lleva el resto y la de premio gordo
   (jackpot) sale de: p_J = (V* − Σ fijas·valor − resto·valor_main) / (valor_J − valor_main).
   El precio del cofre de modo es fijo: 100 tokens (1 $), en chests.mode.price. */
const CHEST_PLAN={ own:1/5, copies:11, eta:0.9, rho:0.5, beta:11, itemSCE:12,
  // [modo, desde fase, rareza T, días, plata/día, madera/día, suerte de la rareza siguiente]
  // (Normal medido con plata comprada con oro, 10/día, y madera solo de jefes y eventos; Pesadilla e Infierno: recalibrar al desbloquearlos)
  seg:[[0,1,'C',3.3,10,3.2,0.05],[0,100,'U',8,10,1.5,0],[1,1,'R',16,8.3,3.0,0],[2,1,'E',20,9,3,0]],
  // cofre de modo por modo: rareza T (de la plata de ese modo), fijas, principal y premio gordo
  mode:[{T:'U',fixed:{U:0.45},main:'R',jackpot:'E'},
        {T:'R',fixed:{U:0.15,L:0.02},main:'R',jackpot:'E'},
        {T:'E',fixed:{R:0.35,M:0.005},main:'E',jackpot:'L'}],
};
(function buildChests(P,C){
  const R=C.rar, idx=r=>R.indexOf(r), r2=x=>Math.round(x*1000)/10;       // % con un decimal
  const vec=o=>R.map(r=>r2(o[r]||0)), fix=v=>{ const d=Math.round((100-v.reduce((a,b)=>a+b,0))*10)/10, k=v.indexOf(Math.max(...v)); v[k]=Math.round((v[k]+d)*10)/10; return v }; // suma exacta 100
  const wood=[[],[],[]], silver=[[],[],[]], mode=[], sceS=[];
  for(const [m,from,T,days,S,W,luck] of P.seg){
    const den=P.own*days*(S+P.rho*W), t=idx(T), pT=Math.min(1,P.copies/(P.eta*den)), pN=t<R.length-1?-Math.log(1-luck)/den:0;
    const mk=k=>{ const o={}; o[R[t+1]]=pN*k; o[T]=Math.min(1-pN*k,pT*k); if(t>0) o[R[t-1]]=(o[R[t-1]]||0)+1-o[T]-pN*k; else o[T]=1-pN*k; return fix(vec(o)) };
    silver[m].push([from,mk(1)]); wood[m].push([from,mk(P.rho)]);
    const sv=mk(1); sceS[m]=R.reduce((a,r,i)=>a+sv[i]/100*Math.pow(P.beta,i-t),0);   // valor de 1 plata en copias de T (último tramo del modo)
  }
  P.mode.forEach((M,m)=>{ const t=idx(M.T), val=r=>Math.pow(P.beta,idx(r)-t), V=P.itemSCE*sceS[m];
    let fs=0, fv=0; for(const r in M.fixed){ fs+=M.fixed[r]; fv+=M.fixed[r]*val(r); }
    const pJ=Math.max(0,(V-fv-(1-fs)*val(M.main))/(val(M.jackpot)-val(M.main))), o={...M.fixed}; o[M.jackpot]=(o[M.jackpot]||0)+pJ; o[M.main]=(o[M.main]||0)+1-fs-pJ;
    mode.push([[1,fix(vec(o))]]); });
  C.chests.wood.odds=wood; C.chests.silver.odds=silver; C.chests.mode.odds=mode;
  C.chestPlan=P;
})(CHEST_PLAN,CFG);
root.CFG=CFG;
if(typeof module!=='undefined'&&module.exports) module.exports=CFG;
})(typeof window!=='undefined'?window:globalThis);
