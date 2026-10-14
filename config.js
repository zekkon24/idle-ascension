/* ARCHIVO GENERADO por tools/construir.js desde src/datos/ (orden en orden.json): no lo edites aquí. */
/* Idle Ascension · configuración de equilibrio.
   Todos los números del juego viven aquí. Lo usan el motor (engine.js) y la interfaz (ui.js). */
(function(root){
const CFG = {
  // ---------- héroe: clases, mejoras de oro, topes, habilidades, evolución y grimorio (trozo de la lista CFG) ----------
  // Clases: las 5 tienen LOS MISMOS NÚMEROS (vida, daño, defensa, velocidad, crítico y crecimiento por nivel); lo que las distingue es un RASGO
  // pequeño que se queda siempre (trait, de valor parecido: ~5 %) y su kit (CFG.kit: habilidades y pasivas de cada camino). El Guerrero recibe
  // menos daño (dmgTaken), el Mago recarga antes (cdr), el Arquero y el Asesino tienen más crítico (cr) y el Clérigo se regenera (regen).
  // Sin esquiva: desapareció del juego. Empiezan con 200 de vida, 20 de daño y 20 de defensa, y cada nivel suma el 1,43 % de eso a las tres
  // (ghp, gatk, gdf). grow: tras la 1.ª y la 2.ª evolución, los niveles nuevos valen grow[i] × lo de antes (en las tres).
  classes: {
    Guerrero:{hp:200,ghp:2.86,atk:20,gatk:0.286,df:20,gdf:0.286,spd:1,cr:0.05,cd:1,grow:[1,1.65],
      ranged:false,color:'#d9774a',dmgTaken:0.95, role:'Resistente · cuerpo a cuerpo', trait:{name:'Aguante',desc:'Recibe un 5 % menos de daño'}},
    Mago:{hp:200,ghp:2.86,atk:20,gatk:0.286,df:20,gdf:0.286,spd:1,cr:0.05,cd:1,grow:[1,1.65],
      ranged:true,color:'#8f7cf0', role:'Habilidades · a distancia', cdr:0.1, trait:{name:'Canalizar',desc:'Sus habilidades se recargan un 10 % más rápido'}},
    Arquero:{hp:200,ghp:2.86,atk:20,gatk:0.286,df:20,gdf:0.286,spd:1,cr:0.10,cd:1,grow:[1,1.65],
      ranged:true,color:'#5fb86a', role:'Crítico · a distancia', trait:{name:'Puntería',desc:'+5 % de crítico'}},
    Asesino:{hp:200,ghp:2.86,atk:20,gatk:0.286,df:20,gdf:0.286,spd:1,cr:0.10,cd:1,grow:[1,1.65],
      ranged:false,color:'#c95a8a', role:'Crítico · cuerpo a cuerpo', trait:{name:'Instinto',desc:'+5 % de crítico'}},
    Clerigo:{hp:200,ghp:2.86,atk:20,gatk:0.286,df:20,gdf:0.286,spd:1,cr:0.05,cd:1,grow:[1,1.65],
      ranged:true,color:'#e9c75a',regen:0.002, role:'Regeneración · a distancia', label:'Clérigo', trait:{name:'Fe',desc:'Regenera el 0,2 % de su vida por segundo'}},
  },
  upgrades:{ // coste ×1,031 por nivel (antes ×1,0325): compensa el calendario que ya no existe
    // Daño, Vida y Defensa suben igual: +1 % por nivel (el doble cada 70), así ninguna se dispara frente a las otras
    atk:{name:'Daño',base:25,g:1.031,mult:1.01},
    hp:{name:'Vida',base:25,g:1.031,mult:1.01},
    df:{name:'Defensa',base:25,g:1.031,mult:1.01},
    spd:{name:'Velocidad de ataque',base:5,g:1.031,mult:1.004}, // +0,4 % por nivel; más barata para que rinda como las demás
  },
  caps:{cr:0.5,ls:0.2},
  skillCd:[6,9,12],   // recarga de cada hueco de habilidad (1.ª, 2.ª y 3.ª), en segundos de combate (el Mago, un 10 % menos)
  skillGap:0.75,      // segundos de espera entre una habilidad y la siguiente (en todos los modos, a mano o solas)
  evo:{ // evoluciones: al llegar al nivel de cada una se cambia de etapa del kit (CFG.kit) y el nivel sigue (hasta evolucionar, ese nivel es el tope)
    tiers:[
      {lvl:150, cost:{ess:3,gold:10000,ev:12}, bonus:{hp:0.15,atk:0.15,df:0.15}},   // cost: esencias del modo Normal + oro + material del evento · bonus: extra de vida, daño y defensa
      {lvl:300, cost:{ess:5,gold:400000,ev:30}, bonus:{hp:0.15,atk:0.15,df:0.15}},  // pide Esencia de pesadilla; sigue el camino de la 1.ª (A → A2 · B → B2)
    ],
  },
  // Grimorio: la LLAVE de la 1.ª evolución. Uno por clase. Se consigue CERRADO (oro + esencias + emblemas, o tokens) y se sube
  // del nivel 1 al 5: cada subida pide tiempo luchando con él (secs, también cuenta el tiempo sin conexión) + recursos.
  // Con el grimorio en el nivel 5 y el héroe en el nivel de la evolución, se evoluciona eligiendo uno de 2 caminos (evo.tiers[0]).
  // Cambiar de camino después cuesta switchCost tokens.
  grimoire:{showLvl:50, // icono del Grimorio (libro) en el combate desde este nivel del héroe (o si ya se tiene)
    levels:5, switchCost:250, cost:{goldH:2,ess:2,ev:4}, pack:300,
    up:[{secs:7200,goldH:1,ess:1,ev:2},{secs:10800,goldH:2,ess:1,ev:3},{secs:14400,goldH:3,ess:2,ev:4},{secs:21600,goldH:4,ess:2,ev:5}],
    names:{Guerrero:'Grimorio del Guerrero',Mago:'Grimorio del Mago',Arquero:'Grimorio del Arquero',Asesino:'Grimorio del Asesino',Clerigo:'Grimorio del Clérigo'}},
  // ---------- kit de cada clase: pasiva y habilidades por etapa (trozo de la lista CFG) ----------
  // Etapas: base (sin evolucionar: 1 habilidad) · A1/B1 (1.ª evolución: pasiva nueva y 2 habilidades) · A2/B2 (2.ª: pasiva y
  // habilidades mejoradas, y una 3.ª). Camino A = área (pasa las oleadas antes) · camino B = un objetivo (mejor contra jefes).
  // mult: veces el daño de un golpe normal (4 = 400 %). Las cargas del héroe (B.*) vuelven a 0 en cada oleada.
  // targets: a cuántos enemigos llega un golpe de área como mucho (3 si es fuerte, 300 % o más · 4 si es medio, 200-299 % · 5 si es flojo o continuo).
  // look: icono y efecto que usa mientras no tenga dibujo propio. Los héroes son iguales (CFG.classes): los porcentajes de las habilidades y
  // las pasivas son los que igualan a las clases (laboratorio: node tests/equilibrio.js laboratorio).
  bleed:{pct:0.5,dur:6,max:3},   // Sangrado del Gladiador: cada carga hace el 50 % de un golpe por segundo durante 6 s
  kit:{
    Guerrero:{
      base:{skills:[{id:'tajo',name:'Tajo',mult:4.3,look:'ejecutar',desc:'430 % a un enemigo'}]},
      A1:{name:'Guardián',passive:{id:'guardia',name:'Guardia',max:3,per:0.03,thorns:0.2,desc:'Cada golpe recibido da 1 de Guardia, hasta 3 (−3 % de daño recibido por carga). Devuelve el 20 % del daño recibido repartido entre todos'},
        skills:[{id:'escudazo',name:'Escudazo',mult:3,area:2.6,targets:5,fijo:['mult'],look:'muro',desc:'300 % al primero y el 260 % a hasta 5'},
                {id:'provocar',name:'Provocar',mult:2.6,shield:0.15,targets:5,look:'baluarte',desc:'260 % a hasta 5 y escudo del 15 % de su vida'}]},
      A2:{name:'Coloso',passive:{id:'guardia',name:'Represalia',max:3,per:0.03,thorns:0.15,wave:4,cd:3,targets:3,desc:'Guardia hasta 3 (−3 % de daño por carga). Con 3, Onda de escudo: el 400 % de su daño a hasta 3 (gasta la Guardia; como mucho una vez cada 3 s). Devuelve el 15 % del daño recibido'},
        skills:[{id:'escudazo',name:'Escudazo II',mult:4,area:3,guard:1,targets:5,fijo:['mult'],look:'muro',desc:'400 % al primero y el 300 % a hasta 5; 1 de Guardia por enemigo alcanzado'},
                {id:'provocar',name:'Provocar II',mult:2,shield:0.15,targets:5,look:'baluarte',desc:'200 % a hasta 5 y escudo del 15 % de su vida'},
                {id:'terremoto',name:'Terremoto',mult:4,dot:1,dur:4,slow:0.8,targets:4,look:'perforante',desc:'400 % a hasta 4 y 100 % por segundo durante 4 s; mientras, los enemigos pegan un 20 % más lento'}]},
      B1:{name:'Gladiador',passive:{id:'furia',name:'Furia',max:3,per:0.05,boss:0.2,desc:'+5 % de daño por golpe recibido, hasta 3 (+15 %). +20 % de daño a los jefes'},
        skills:[{id:'desgarro',name:'Desgarro',mult:6.7,bleed:1,look:'ejecutar',desc:'670 % y 1 Sangrado (hasta 3; cada uno, 50 % por segundo durante 6 s)'},
                {id:'triple',name:'Triple',hits:3,mult:2.8,perRage:0.67,look:'perforante',desc:'3 tajos del 280 %; cada uno +67 % por carga de Furia (las gasta)'}]},
      B2:{name:'Berserker',passive:{id:'furia',name:'Frenesí',max:3,per:0.07,boss:0.2,ls:0.2,desc:'+7 % de daño por carga de Furia (hasta +21 %); con 3, +20 % de robo de vida. +20 % de daño a los jefes'},
        skills:[{id:'desgarro',name:'Desgarro II',mult:11,bleed:2,low:0.3,lowMul:2,look:'ejecutar',desc:'1.100 % y 2 Sangrados; el doble si le queda menos del 30 % de vida'},
                {id:'triple',name:'Triple II',hits:3,mult:3.9,perRage:0.77,bleed:1,look:'perforante',desc:'3 tajos del 390 % (+77 % por Furia gastada); cada uno pone 1 Sangrado'},
                {id:'ejecutar',name:'Ejecutar',mult:4.6,low:0.3,lowMult:15,look:'ejecutar',desc:'1.500 % si al enemigo le queda menos del 30 % de vida (si no, 460 %)'}]},
    },
    Mago:{
      base:{skills:[{id:'misil',name:'Misil',hits:3,mult:1.2,look:'bola',desc:'3 proyectiles del 120 %'}]},
      A1:{name:'Piromante',passive:{id:'ignicion',name:'Ignición',max:3,spread:3,pct:0.35,dur:4,desc:'Cada golpe quema (35 % de su daño por segundo, 4 s), hasta 3 quemaduras; al llegar a 3 se contagian al siguiente enemigo'},
        skills:[{id:'llama',name:'Llama',targets:3,mult:3.5,burn:1,look:'bola',desc:'350 % hasta a 3 enemigos y 1 quemadura'},
                {id:'explosion',name:'Explosión',mult:2.4,burn:1,targets:4,look:'combustion',desc:'240 % a hasta 4 y 1 quemadura'}]},
      A2:{name:'Infernal',passive:{id:'ignicion',name:'Incendio',max:5,spread:3,pct:0.44,dur:4,desc:'Cada golpe quema (44 % de su daño por segundo, 4 s), hasta 5 quemaduras; siguen contagiándose al llegar a 3'},
        skills:[{id:'llama',name:'Llama II',targets:3,mult:4.4,burn:1,perBurn:0.72,look:'bola',desc:'440 % hasta a 3 enemigos (+72 % por quemadura) y 1 quemadura'},
                {id:'explosion',name:'Explosión II',mult:3,burn:2,perBurn:0.44,targets:4,look:'combustion',desc:'300 % a hasta 4 (+44 % por quemadura) y 2 quemaduras'},
                {id:'meteoros',name:'Meteoros',n:5,over:3,mult:2,perBurn:0.3,targets:5,look:'combustion',desc:'5 meteoritos en 3 s: 200 % a hasta 5 cada uno (+30 % por quemadura)'}]},
      B1:{name:'Criomante',passive:{id:'esquirlas',name:'Esquirlas',need:3,mult:0.37,freeze:2,ignoreDf:0.5,desc:'Cada golpe clava 1 esquirla; con 3, estallido del 37 % (ignora la mitad de su defensa) que congela 2 s'},
        skills:[{id:'escarcha',name:'Escarcha',mult:0.53,freeze:2,look:'armaduraHielo',desc:'53 % y congela 2 s'},
                {id:'lanza',name:'Lanza',mult:0.68,frozenMul:2,look:'perforante',desc:'68 %; el doble si está congelado'}]},
      B2:{name:'Glaciar',passive:{id:'esquirlas',name:'Destrozar',need:3,mult:0.31,freeze:3,ignoreDf:0.5,frozenTaken:0.3,desc:'Estallido del 31 % que congela 3 s; los congelados reciben un 30 % más de daño'},
        skills:[{id:'escarcha',name:'Escarcha II',mult:0.49,freeze:3,shards:3,look:'armaduraHielo',desc:'49 %, congela 3 s y clava las 3 esquirlas (estallido al momento)'},
                {id:'lanza',name:'Lanza II',mult:0.62,frozenMul:3,look:'perforante',desc:'62 %; el triple si está congelado'},
                {id:'cometa',name:'Cometa',mult:0.94,frozenMul:2,look:'armaduraHielo',desc:'94 %; el doble si está congelado'}]},
    },
    Arquero:{
      base:{skills:[{id:'disparo',name:'Disparo',mult:3.5,look:'perforante',desc:'350 % al primer enemigo'}]},
      A1:{name:'Tirador',passive:{id:'doble',name:'Doble',chance:0.2,max:3,per:0.05,desc:'20 % de disparar 2 flechas a 2 enemigos; cada doble da 1 de Concentración, hasta 3 (+5 % de daño por carga)'},
        skills:[{id:'multidisparo',name:'Multidisparo',mult:2.6,targets:5,look:'perforante',desc:'Una flecha del 260 % a cada enemigo (hasta 5)'},
                {id:'lluvia',name:'Lluvia',waves:4,over:3,mult:0.99,targets:5,look:'rapido',desc:'Durante 3 s, 4 oleadas de flechas del 99 % a hasta 5'}]},
      A2:{name:'Vendaval',passive:{id:'doble',name:'Triple',chance:0.2,max:3,per:0.05,triple:true,desc:'Dobles al 20 %; con 3 de Concentración, los dobles pasan a triples'},
        skills:[{id:'multidisparo',name:'Multidisparo II',mult:1.5,targets:5,times:2,look:'perforante',desc:'2 abanicos seguidos del 150 % (hasta 5 cada vez)'},
                {id:'lluvia',name:'Lluvia II',waves:4,over:3,mult:0.77,perConc:1,targets:5,look:'rapido',desc:'4 oleadas del 77 % a hasta 5, +1 oleada por carga de Concentración'},
                {id:'perforar',name:'Perforar',mult:3.1,targets:3,look:'perforante',desc:'Una flecha que atraviesa a 3 (310 % a cada uno)'}]},
      B1:{name:'Acechador',passive:{id:'ritmo',name:'Ritmo',max:3,mul:2.2,desc:'Cada disparo al mismo enemigo da 1 carga, hasta 3; el que llega a 3 hace el 220 % y vuelve a 0'},
        skills:[{id:'apuntar',name:'Apuntar',mult:10,charge:1.5,look:'marca',desc:'Apunta 1,5 s y hace 1.000 %'},
                {id:'rafaga',name:'Ráfaga',hits:5,mult:1.4,look:'rapido',desc:'5 flechas del 140 % al mismo enemigo'}]},
      B2:{name:'Francotirador',passive:{id:'ritmo',name:'Letal',max:3,mul:2,crit:true,desc:'El disparo que llega a 3 de Ritmo hace el 200 % y siempre es crítico'},
        skills:[{id:'apuntar',name:'Apuntar II',mult:6.7,charge:0.8,look:'marca',desc:'Apunta 0,8 s y hace 670 %'},
                {id:'rafaga',name:'Ráfaga II',hits:8,mult:0.86,rhythm:true,look:'rapido',desc:'8 flechas del 86 %; cada una suma al Ritmo'},
                {id:'remate',name:'Remate',mult:2.8,perStack:2,look:'marca',desc:'280 % +200 % por cada carga de Ritmo que gasta'}]},
    },
    Asesino:{
      base:{skills:[{id:'punalada',name:'Puñalada',mult:3.7,look:'ejecutar',desc:'370 % a un enemigo'}]},
      A1:{name:'Danzante',passive:{id:'cuchillas',name:'Cuchillas',max:3,pct:0.52,dur:6,targets:5,desc:'Cada crítico añade 1 cuchilla que gira a su alrededor, hasta 3; cada una hace el 52 % por segundo a hasta 5 cercanos (dura 6 s)'},
        skills:[{id:'giro',name:'Giro',mult:3.2,targets:4,look:'clon',desc:'320 % a los cercanos (hasta 4)'},
                {id:'abanico',name:'Abanico',mult:2.5,targets:4,look:'perforante',desc:'250 % a hasta 4'}]},
      A2:{name:'Huracán',passive:{id:'cuchillas',name:'Enjambre',max:5,pct:0.55,dur:6,targets:5,desc:'Hasta 5 cuchillas; cada una hace el 55 % por segundo a hasta 5 cercanos'},
        skills:[{id:'giro',name:'Giro II',mult:4.1,targets:4,blades:1,look:'clon',desc:'410 % a los cercanos (hasta 4) y añade 1 cuchilla'},
                {id:'abanico',name:'Abanico II',mult:3.3,fill:true,targets:4,look:'perforante',desc:'330 % a hasta 4 y llena las cuchillas'},
                {id:'torbellino',name:'Torbellino',dur:3,every:0.3,mult:0.94,targets:5,look:'clon',desc:'Durante 3 s, 94 % a hasta 5 cada 0,3 s'}]},
      B1:{name:'Víbora',passive:{id:'veneno',name:'Veneno',max:3,pct:0.78,dur:8,desc:'Cada golpe envenena (78 % de su daño por segundo, 8 s), hasta 3 capas'},
        skills:[{id:'mutilar',name:'Mutilar',hits:2,mult:2.7,stacks:1,look:'ejecutar',desc:'2 puñaladas del 270 %; cada una pone 1 capa de veneno'},
                {id:'envenenar',name:'Envenenar',mult:3.4,perStack:1.8,look:'nube',desc:'340 % +180 % por cada capa de veneno que gasta'}]},
      B2:{name:'Plaga',passive:{id:'veneno',name:'Toxina',max:5,pct:1.2,dur:8,desc:'Hasta 5 capas de veneno (cada una, 120 % de su daño por segundo, 8 s)'},
        skills:[{id:'mutilar',name:'Mutilar II',hits:2,mult:4,perStack:0.33,stacks:1,look:'ejecutar',desc:'2 puñaladas del 400 % (+33 % por capa de veneno); cada una pone 1 capa'},
                {id:'envenenar',name:'Envenenar II',mult:6.5,perStack:3.3,look:'nube',desc:'650 % +330 % por cada capa que gasta'},
                {id:'milcortes',name:'Mil cortes',hits:8,mult:1.3,stacks:1,look:'nube',desc:'8 golpes del 130 % al mismo enemigo; cada uno pone 1 capa'}]},
    },
    Clerigo:{
      base:{skills:[{id:'luz',name:'Luz',hits:6,mult:0.49,back:0.6,heal:0.05,look:'luz',desc:'6 golpes de luz encadenados del 49 % que vuelven y le curan el 5 % cada uno'}]},
      A1:{name:'Oráculo',passive:{id:'gracia',name:'Gracia',max:3,heal:0.1,hit:2,cd:3,targets:3,desc:'Cada golpe recibido da 1 de Luz, hasta 3; con 3, se cura el 10 % y hace el 200 % de su daño a hasta 3 cercanos (como mucho una vez cada 3 s)'},
        skills:[{id:'cadena',name:'Cadena',jumps:8,mult:0.4,heal:0.01,targets:5,look:'luz',desc:'8 saltos del 40 % entre hasta 5 enemigos; cada salto le cura un 1 %'},
                {id:'consagrar',name:'Consagrar',dur:6,dps:0.61,heal:0.01,targets:5,look:'juicio',desc:'Durante 6 s, 61 % a hasta 5 cada segundo, y se cura el 1 % por segundo'}]},
      A2:{name:'Santo',passive:{id:'gracia',name:'Bendición',max:5,heal:0.15,hit:6.4,cd:3,targets:3,desc:'Hasta 5 de Luz; con 5, se cura el 15 % y hace el 640 % de su daño a hasta 3 cercanos (como mucho una vez cada 3 s)'},
        skills:[{id:'cadena',name:'Cadena II',jumps:8,mult:0.98,heal:0.01,luzEvery:3,targets:5,look:'luz',desc:'8 saltos del 98 % entre hasta 5; cada salto cura un 1 % y cada 3 saltos, +1 de Luz'},
                {id:'consagrar',name:'Consagrar II',dur:8,dps:1.8,heal:0.015,targets:5,look:'juicio',desc:'Durante 8 s, 180 % a hasta 5 cada segundo, y se cura el 1,5 % por segundo'},
                {id:'juicio',name:'Juicio',mult:8.4,healPer:0.03,targets:3,look:'juicio',desc:'840 % a hasta 3 y se cura el 3 % por enemigo alcanzado'}]},
      B1:{name:'Hereje',passive:{id:'corrupcion',name:'Corrupción',max:3,pct:0.35,dur:8,healK:0.2,desc:'Cada golpe pone 1 Sombra al enemigo, hasta 3; cada Sombra hace el 35 % de su daño por segundo y le cura una parte (como robo de vida)'},
        skills:[{id:'sombra',name:'Sombra',mult:3.1,stacks:2,look:'sacrificio',desc:'310 % y 2 Sombras'},
                {id:'estallido',name:'Estallido',mult:2.6,perStack:0.85,look:'sacrificio',desc:'260 % +85 % por cada Sombra del enemigo'}]},
      B2:{name:'Profanador',passive:{id:'corrupcion',name:'Vacío',max:5,pct:0.55,dur:8,healK:0.2,desc:'Hasta 5 Sombras (cada una, 55 % de su daño por segundo)'},
        skills:[{id:'sombra',name:'Sombra II',mult:5.5,perStack:0.68,stacks:2,look:'sacrificio',desc:'550 % (+68 % por Sombra) y 2 Sombras'},
                {id:'estallido',name:'Estallido II',mult:5.5,perStack:2.1,look:'sacrificio',desc:'550 % +210 % por cada Sombra'},
                {id:'devorar',name:'Devorar',perStack:3.4,reapply:3,look:'sacrificio',desc:'Hace estallar las Sombras (340 % por cada una, y se cura una parte) y vuelve a poner 3'}]},
    },
  },
  // ---------- enemigos: curvas, encuentros especiales y mecánicas (trozo de la lista CFG) ----------
  enemy:{ // vida y ataque de los enemigos normales: ver modes (héroe de referencia)
         dfK:0.25,   // defensa de un enemigo = ¼ del daño del héroe típico de su fase (le quita 1/8 de cada golpe); fase 1: 5
         jefe:{hp:2,atk:1},   // JEFE (fases 30, 60, 90, 120 y 150 de cada modo) = el doble de vida que el élite de su tramo y su mismo ataque (sus habilidades ya pegan; cada uno con su ajuste k en zonas)
         waveHp:0.0145,
         bossHp:1.5,bossAtk:1.5,   // (respaldo: bossBands manda) jefe cada 10 fases: vida en oleadas (1 = toda la oleada de su fase), ataque en enemigos (1 = un enemigo)
         bossBands:[[1,1.6,1.4],[51,1.25,1.2],[101,1.0,1.0],[151,1.0,1.0]], // ÉLITE (fases 10 y 20 de cada zona) y errante: [desde fase, vida en oleadas, ataque en enemigos]; un poco más que una oleada + mecánica a mitad de vida
         extraEvery:50,spd:0.8,walk:2.0,dash:0.05, // dash: Embestida de los de cuerpo a cuerpo (esperan el 5 % del camino)
         // Oleadas progresivas: n0 enemigos (+1 cada nEvery fases, máx. nMax); salen g0 a la vez (+1 cada gEvery fases, máx. gMax),
         // separados gap s; andan y pegan hasta un spd más rápido en la fase 150. La vida de la oleada entera es la de siempre
         // (repartida entre más enemigos) × hpMul; atkG: ataque de cada enemigo × atkG por cada uno de más que sale a la vez.
         waves:{n0:3,nEvery:25,nMax:8,g0:1,gEvery:50,gMax:3,gap:0.35,spd:0.2,hpMul:1.12,atkG:0.85}},
  // Sorpresas en la campaña (cada every±jitter s de combate; no en jefes ni eventos): Horda (dur s, enemigos ×count, oro ×gold)
  // o Jefe errante (vida = hp × la vida de la oleada, ataque ×atk; hay que vencerlo en dur s → cofre de plata)
  // Entrada de los combates: élite y JEFE (y los de la Torre) esperan a que se vaya el cartel; los combates normales de la Torre, un respiro
  // bossTime: élite y JEFE de la campaña tienen ese tiempo (s); si no caen, cuenta como derrota (así ningún combate dura para siempre)
  encounter:{intro:2, towerIntro:0.9, bossTime:90},
  // ---------- zonas: monstruos, élites y JEFES de cada modo (trozo de la lista CFG) ----------
  // Cada modo tiene 5 zonas de 30 fases: élite 1 en su fase 10, élite 2 en la 20 y JEFE en la 30 (JEFES en 30, 60, 90, 120 y 150).
  // Élite: 1 pasiva (p) y 1 habilidad (s). JEFE: su pasiva, su habilidad propia (own) y las de sus élites mejoradas (s1, s2: II).
  // mult: veces el golpe normal de ese enemigo (2 = 200 %). cd: recarga escrita en el diseño (en el juego, × cdK: un 35 % menos).
  // dot: cargas en el héroe ({k, n}; cada carga quita pct de su vida por segundo, ver heroDot). stun: segundos sin atacar ni lanzar.
  // k: ajuste propio de vida y ataque de ese élite o JEFE ({hp, atk}; 1 si no está), medido con simulaciones para que su mecánica no lo haga un muro.
  // def: acorazado (1 élite por zona: ×3 de defensa en Normal, ×4 en Pesadilla, ×5 en Infierno). Para que al héroe típico le cueste lo mismo
  //   lleva menos vida; quien tiene más daño lo atraviesa mejor, y lo que ignora defensa (Esquirlas del Mago B, armas Vacío y Filo del vacío), también. Sale en su cartel.
  // muro: × vida y ataque solo en la campaña (no en Torre, Sala de jefes, Jefe semanal ni Errante): cuánto frena (tests/equilibrio/ajustar-jefes.js).
  //   Los JEFES frenan de ×0,8 la media de su modo (el 1.º) a ×1,2 (el último) y los élites, 1/6 del JEFE de su zona; la primera zona de Normal no lo lleva.
  // art: su dibujo (los de Normal llevan el color del modo) · scene: escenario. escort: el élite sale con N monstruos normales de su zona.
  // SIN BALANCEAR: los números salen del diseño y se ajustan con simulaciones.
  heroDot:{veneno:{pct:0.01,dur:6,max:3}, sangrado:{pct:0.01,dur:6,max:3}, quemadura:{pct:0.01,dur:6,max:3}},
  zones:{cdK:0.65, first:3,   // first: segundos hasta la primera habilidad
    minion:{hp:0.6,atk:0.6},   // esbirros que llaman (lobos, goblins, zombis…): vida y ataque × los de un monstruo normal de la fase
    list:[
    [ // ---------- Normal ----------
      {id:'slimes',name:'Slimes',where:'pradera',art:'slime',scene:0,
        e1:{name:'Slime Gordo',muro:1.1,def:3,p:{id:'dividirse',name:'Dividirse',at:0.5,n:2,hp:0.25,desc:'Al 50 % de vida suelta 2 slimes con el 25 % de su vida cada uno'},
            s:{name:'Aplastar',cd:10,mult:2,stun:1,desc:'200 % y aturde 1 s'}},
        e2:{name:'Slime Ácido',muro:1.23,p:{id:'dotGolpe',name:'Corrosión',dot:'veneno',desc:'Cada golpe envenena (hasta 3 cargas; 1 % de tu vida por segundo cada una)'},
            s:{name:'Escupitajo venenoso',cd:10,mult:1.5,dot:{k:'veneno',n:3},desc:'150 % y las 3 cargas de veneno de golpe'}},
        jefe:{name:'Slimey',k:{hp:0.5,atk:0.7},muro:1.37,title:'el Rey Slime',p:{id:'division',name:'División',at:[0.75,0.5,0.25],n:2,hp:0.1,desc:'Al 75 %, 50 % y 25 % de vida suelta 2 slimes'},
            own:{id:'absorber',name:'Absorber',after:10,grow:0.15,desc:'Los slimes que siguen vivos a los 10 s se los come: suma su vida y su ataque y crece'},
            s1:{name:'Aplastar II',cd:10,mult:3,stun:1.5,desc:'300 % y aturde 1,5 s'},
            s2:{name:'Escupitajo venenoso II',cd:10,mult:2.5,dot:{k:'veneno',n:3},dotX:{mul:2,dur:6},desc:'250 % y 3 de veneno; 6 s con el veneno al doble'}}},
      {id:'lobos',name:'Lobos',where:'bosque',art:'wolf',scene:2,
        e1:{name:'Huargo',muro:1.15,def:3,p:{id:'dotGolpe',name:'Colmillos',dot:'sangrado',desc:'Cada mordisco te hace sangrar (hasta 3 cargas)'},
            s:{name:'Yugular',cd:10,mult:2.5,low:{below:0.5,mul:2},desc:'250 %; el doble si te queda menos del 50 % de vida'}},
        e2:{name:'Lobo Acechador',muro:1.17,p:{id:'acecho',name:'Acecho',mult:3,stun:1,desc:'Su primer golpe hace 300 % y aturde 1 s'},
            s:{name:'Salto',cd:10,mult:2,acecho:true,desc:'200 % y repite el golpe de Acecho'}},
        jefe:{name:'Fenrir',muro:0.87,title:'',p:{id:'alfa',name:'Alfa',every:15,n:2,per:0.1,max:5,desc:'Cada 15 s aúlla y llama a 2 lobos; +10 % de daño por lobo vivo (hasta +50 %)'},
            own:{id:'lunaLlena',name:'Luna llena',at:0.5,heal:0.2,dmg:0.3,grow:0.3,desc:'Al bajar del 50 % se transforma: crece, se cura el 20 % y hace +30 % de daño'},
            s1:{name:'Yugular II',cd:10,mult:3.5,low:{below:0.5,mul:2},desc:'350 %; el doble si te queda menos del 50 %'},
            s2:{name:'Salto II',cd:10,mult:3,stun:1.5,desc:'300 % y aturde 1,5 s'}}},
      {id:'goblins',name:'Goblins',where:'cueva',art:'goblin',scene:1,
        e1:{name:'Goblin Bruto',muro:1.32,def:3,p:{id:'cabezaDura',name:'Cabeza dura',crit:0.3,desc:'Recibe un 30 % menos de los golpes críticos'},
            s:{name:'Garrotazo',cd:10,mult:3,stun:1,desc:'300 % y aturde 1 s'}},
        e2:{name:'Goblin Chamán',muro:1.24,escort:2,p:{id:'totem',name:'Tótem',hp:0.15,heal:0.03,desc:'Pone un tótem (con el 15 % de su vida) que cura a los goblins el 3 % por segundo'},
            s:{name:'Rayo',cd:8,mult:2,desc:'200 %'}},
        jefe:{name:'Snag',k:{atk:0.7},muro:1.17,title:'el Rey Goblin',p:{id:'llamada',name:'Escudo de goblins',every:15,n:2,dr:0.1,max:5,desc:'Cada 15 s llama a 2 goblins; −10 % de daño recibido por goblin vivo (hasta −50 %)'},
            own:{name:'Rabieta',cd:20,dur:4,every:0.5,mult:0.6,desc:'4 s golpeando sin parar: 60 % cada medio segundo'},
            s1:{name:'Garrotazo II',cd:10,mult:4,stun:1.5,desc:'400 % y aturde 1,5 s'},
            s2:{name:'Rayo II',cd:8,mult:3,desc:'300 %'}}},
      {id:'nomuertos',name:'No muertos',where:'cementerio',art:'skeleton',scene:3,
        e1:{name:'Esqueleto Rearmado',muro:1.18,p:{id:'rearmarse',name:'Rearmarse',after:3,hp:0.5,desc:'3 s después de morir se levanta con el 50 % de vida (una vez)'},
            s:{name:'Tajo oxidado',cd:8,mult:2,defDown:{pct:0.1,dur:6},desc:'200 % y −10 % de defensa 6 s'}},
        e2:{name:'Caballero Óseo',muro:1.31,def:3,p:{id:'armaduraHueso',name:'Armadura de hueso',sh:0.3,every:15,desc:'Escudo del 30 % de su vida que vuelve cada 15 s'},
            s:{name:'Carga',cd:10,mult:2.5,stun:1,desc:'250 % y aturde 1 s'}},
        jefe:{name:'Mortimer',k:{hp:0.6,atk:0.7},muro:1.4,title:'el Rey Esqueleto',p:{id:'ejercito',name:'Ejército eterno',every:15,n:2,desc:'Cada 15 s levanta 2 esqueletos que se rearman al morir'},
            own:{id:'reencarnacion',name:'Reencarnación',after:3,hp:0.5,buff:0.5,desc:'La primera vez que muere se levanta a los 3 s con el 50 %; mientras, sus esqueletos pegan +50 %'},
            s1:{name:'Tajo oxidado II',cd:8,mult:3,defDown:{pct:0.15,dur:6},desc:'300 % y −15 % de defensa 6 s'},
            s2:{name:'Carga II',cd:10,mult:3.5,stun:1.5,desc:'350 % y aturde 1,5 s'}}},
      {id:'orcos',name:'Orcos',where:'campamento',art:'orc',scene:4,
        e1:{name:'Orco Berserker',muro:1.44,p:{id:'ansia',name:'Ansia de sangre',per:0.1,max:3,desc:'Cada golpe que da, +10 % de velocidad (hasta +30 %)'},
            s:{name:'Hachazo',cd:10,mult:3,dot:{k:'sangrado',n:1,pct:0.02,dur:4},desc:'300 % y sangrado (2 % de tu vida por segundo, 4 s)'}},
        e2:{name:'Gran Orco',muro:1.25,def:3,escort:2,p:{id:'waaagh',name:'¡Waaagh!',per:0.1,max:3,desc:'Cada orco que muere a su lado le da +10 % de daño y de vida (hasta 3)'},
            s:{name:'Giro brutal',cd:12,dur:4,every:0.5,mult:0.6,desc:'4 s girando: 60 % cada medio segundo'}},
        jefe:{name:'Warmaw',k:{hp:0.5,atk:0.7},muro:1.09,title:'el Señor Orco',p:{id:'festin',name:'Festín de guerra',hits:10,per:0.05,max:0.3,every:20,n:2,eat:8,eatPer:0.1,eatMax:5,desc:'Cada 10 golpes que recibe, +5 % de daño (hasta +30 %); cada 20 s llama a 2 orcos y a los 8 s se come a los vivos (+10 % de vida y daño cada uno)'},
            own:{id:'llamar',name:'Grito del señor de la guerra',cd:25,n:4,desc:'Llama a 4 orcos de golpe'},
            s1:{name:'Hachazo II',cd:10,mult:4,dot:{k:'sangrado',n:1,pct:0.03,dur:4},desc:'400 % y un sangrado más fuerte'},
            s2:{name:'Giro brutal II',cd:12,dur:6,every:0.5,mult:0.7,desc:'6 s girando: 70 % cada medio segundo'}}},
    ],
    [ // ---------- Pesadilla (terror) ----------
      {id:'zombis',name:'Zombis podridos',where:'pradera',art:'zombie',scene:0,
        e1:{name:'Zombi Corredor',muro:1.06,p:{id:'infecta',name:'Infección',max:3,per:0.05,desc:'Cada mordisco te infecta (hasta 3; −5 % de curación cada una)'},
            s:{name:'Abalanzarse',cd:10,mult:2.5,stun:1,desc:'250 % y aturde 1 s'}},
        e2:{name:'Zombi Gordo',muro:0.97,def:4,p:{id:'gases',name:'Gases',max:3,per:0.05,boom:3,desc:'Al recibir daño suelta gases que te infectan; al morir revienta (300 %)'},
            s:{name:'Vómito',cd:10,mult:1.5,dot:{k:'veneno',n:2},desc:'150 % y 2 cargas de veneno'}},
        jefe:{name:'Zuman',k:{hp:0.5,atk:0.7},muro:1.02,title:'el Rey Podrido',p:{id:'pudricion',name:'Pudrición real',max:5,per:0.04,desc:'Cada golpe suyo o de sus zombis te pudre (hasta 5; −4 % de vida máxima cada una)'},
            own:{id:'llamar',name:'Marea de muertos',cd:25,n:6,desc:'Llama a 6 zombis de golpe'},
            s1:{name:'Abalanzarse II',cd:10,mult:3.5,stun:1.5,desc:'350 % y aturde 1,5 s'},
            s2:{name:'Vómito II',cd:10,mult:2.5,dot:{k:'veneno',n:3},desc:'250 % y 3 cargas de veneno'}}},
      {id:'marionetas',name:'Marionetas malditas',where:'bosque',art:'puppet',scene:2,
        e1:{name:'Caja sorpresa',muro:1.27,p:{id:'caja',name:'Dentro de la caja',every:8,hide:2,dr:0.7,desc:'Cada 8 s se esconde 2 s y recibe un 70 % menos de daño'},
            s:{id:'sorpresa',name:'¡Sorpresa!',mult:2.5,stun:1,desc:'Al salir de la caja: 250 % y aturde 1 s'}},
        e2:{name:'Muñeco de ventrílocuo',muro:1.02,def:4,p:{id:'burla',name:'Burla',max:3,per:0.05,desc:'Cada golpe te roba un 5 % de ataque (hasta −15 %)'},
            s:{id:'imitar',name:'Imitar',cd:15,mul:1,desc:'Repite contra ti tu última habilidad, con su daño'}},
        jefe:{name:'Mister Strings',k:{atk:0.8},muro:0.91,title:'el Titiritero',p:{id:'hilos',name:'Hilos',every:15,n:2,dr:0.6,desc:'Cada 15 s llama a 2 marionetas; mientras vivan, recibe un 60 % menos de daño'},
            own:{id:'clon',name:'Marioneta del héroe',cd:30,pct:0.4,desc:'Crea una copia tuya (40 % de tu vida y ataque) que te ataca hasta que la matas'},
            s1:{name:'¡Sorpresa! II',cd:8,mult:3.5,stun:1.5,desc:'350 % y aturde 1,5 s'},
            s2:{id:'imitar',name:'Imitar II',cd:15,mul:1.5,desc:'Repite tu última habilidad con un 50 % más de daño'}}},
      {id:'abominaciones',name:'Abominaciones de carne',where:'cueva',art:'flesh',scene:1,
        e1:{name:'Carnicero',muro:1.19,def:4,p:{id:'robaVida',name:'Carne fresca',pct:0.25,desc:'Se cura el 25 % de lo que te hace'},
            s:{name:'Cuchillada',cd:10,mult:3,dot:{k:'sangrado',n:1,pct:0.02,dur:4},desc:'300 % y sangrado 4 s'}},
        e2:{name:'Divisor',muro:1.34,p:{id:'desmembrarse',name:'Desmembrarse',n:3,after:8,hp:0.5,desc:'Al morir se parte en 3 trozos; si no los matas en 8 s, se vuelve a montar con el 50 %'},
            s:{name:'Latigazo',cd:10,mult:2.5,desc:'250 %'}},
        jefe:{name:'Stitches',k:{hp:0.8,atk:0.7},muro:1.01,title:'el Remendado',p:{id:'descosido',name:'Descosido',step:0.25,dmg:0.2,max:3,desc:'Por cada 25 % de vida que pierde: +20 % de daño y suelta un trozo que ataca (hasta 3)'},
            own:{name:'Golpe odioso',cd:15,mult:4,perStitch:1,desc:'400 %, +100 % por cada vez que se ha descosido'},
            s1:{name:'Cuchillada II',cd:10,mult:4,dot:{k:'sangrado',n:1,pct:0.03,dur:4},desc:'400 % y un sangrado más fuerte'},
            s2:{name:'Latigazo II',cd:10,mult:3.5,desc:'350 %'}}},
      {id:'vampiros',name:'Vampiros',where:'cementerio',art:'vampire',scene:3,
        e1:{name:'Enjambre de sangre',muro:1.22,p:{id:'sed',name:'Sed',below:0.5,spd:1.5,desc:'Si te queda menos del 50 % de vida, ataca un 50 % más rápido'},
            s:{name:'Picadura',cd:8,hits:10,mult:0.25,heal:1,desc:'10 picaduras del 25 %; se cura todo lo que hace'}},
        e2:{name:'Novia vampira',muro:1.3,def:4,p:{id:'beso',name:'Beso',pct:0.02,desc:'Cada golpe te roba el 2 % de tu vida y se la queda'},
            s:{name:'Hipnosis',cd:15,noAttack:2,desc:'Te hipnotiza 2 s (no atacas)'}},
        jefe:{name:'Conde Crimson',k:{atk:0.7},muro:1.1,title:'',p:{id:'senorSangre',name:'Señor de la sangre',pct:0.3,step:0.1,per:0.1,max:5,desc:'Roba el 30 % de lo que hace; cada 10 % de vida que recupera así, +10 % de daño (hasta 5 veces)'},
            own:{id:'murcielagos',name:'Forma de murciélagos',cd:20,dur:3,every:0.5,mult:0.5,desc:'3 s en murciélagos (no recibe daño), que pegan 50 % cada medio segundo y le curan'},
            s1:{name:'Picadura II',cd:8,hits:14,mult:0.25,heal:1,desc:'14 picaduras del 25 %; se cura todo lo que hace'},
            s2:{name:'Hipnosis II',cd:15,noAttack:3,desc:'Te hipnotiza 3 s'}}},
      {id:'pesadillas',name:'Pesadillas vivas',where:'portal',art:'nightmare',scene:4,
        e1:{name:'La Sonrisa',muro:2.12,p:{id:'locura',name:'Locura',max:3,dur:2,desc:'Cada golpe te da 1 de locura; con 3, durante 2 s atacas a un enemigo al azar'},
            s:{name:'Sonrisa',cd:12,mult:2,madness:1,desc:'200 % y 1 de locura'}},
        e2:{name:'El Sin Rostro',muro:1.82,def:4,p:{id:'estatica',name:'Estática',cd:0.3,desc:'Mientras viva, tus habilidades tardan un 30 % más en recargar'},
            s:{name:'Aparecer detrás',cd:10,mult:3,desc:'Aparece detrás de ti: 300 %'}},
        jefe:{name:'Sleepless',muro:1.29,title:'el Rey de las Pesadillas',p:{id:'sueno',name:'Cambio de sueño',every:15,dur:8,burn:0.02,slow:0.6,steal:0.5,copies:2,desc:'Cada 15 s cambia una regla al azar durante 8 s: el suelo arde, atacas más lento, los enemigos roban vida o aparecen 2 copias de un élite'},
            own:{id:'peorMiedo',name:'Tu peor miedo',cd:30,hp:0.5,desc:'Llama a un élite de Pesadilla al azar, con el 50 % de vida'},
            s1:{name:'Sonrisa II',cd:12,mult:3,madness:2,desc:'300 % y 2 de locura'},
            s2:{name:'Aparecer detrás II',cd:10,mult:4.5,desc:'450 %'}}},
    ],
    [ // ---------- Infierno ----------
      {id:'diablillos',name:'Diablillos',where:'pradera',art:'imp',scene:0,
        e1:{name:'Diablillo de fuego',muro:0.99,def:5,p:{id:'dotGolpe',name:'Fuego infernal',dot:'quemadura',ranged:true,desc:'Ataca desde lejos, antes de llegar; cada golpe te quema (hasta 3 cargas)'},
            s:{name:'Bola de fuego',cd:8,mult:2.5,dot:{k:'quemadura',n:1},desc:'250 % y 1 quemadura'}},
        e2:{name:'Diablillo travieso',muro:1.14,p:{id:'invisible',name:'Invisible',every:10,dur:2,desc:'Cada 10 s se vuelve invisible 2 s (no se le puede atacar)'},
            s:{name:'Robar el arma',cd:15,mult:1.5,noSkills:4,desc:'150 % y te quita el arma: 4 s sin habilidades'}},
        jefe:{name:'Brimstone',k:{hp:0.5,atk:0.7},muro:1.32,title:'el Guardián de la Puerta',p:{id:'puerta',name:'Puerta cerrada',every:10,n:2,per:0.05,max:5,desc:'Cada 10 s llegan 2 diablillos; cada uno que muere le da +5 % de defensa (hasta 5)'},
            own:{id:'encierro',name:'Cerrar la puerta',cd:20,dur:2,pct:0.03,desc:'Te encierra 2 s (no atacas) mientras el fuego te quita el 3 % de vida por segundo'},
            s1:{name:'Bola de fuego II',cd:8,mult:3.5,dot:{k:'quemadura',n:2},desc:'350 % y 2 quemaduras'},
            s2:{name:'Robar el arma II',cd:15,mult:1.5,noSkills:6,desc:'150 % y 6 s sin habilidades'}}},
      {id:'sucubos',name:'Súcubos',where:'bosque',art:'succubus',scene:2,
        e1:{name:'Íncubo',muro:0.91,def:2,p:{id:'armaduraInf',name:'Armadura infernal',hits:5,per:0.5,max:3,desc:'Empieza con el doble de defensa; cada 5 golpes que recibe, +50 % más (hasta 3 veces)'},
            s:{name:'Golpe de escudo',cd:10,mult:3,desc:'300 %'}},
        e2:{name:'Hechicera del deseo',muro:1.08,p:{id:'beso',name:'Beso robado',pct:0.02,desc:'Cada golpe te roba el 2 % de tu vida'},
            s:{name:'Encanto',cd:15,charm:3,desc:'Durante 3 s no puedes atacarla'}},
        jefe:{name:'Vesper',k:{hp:0.7,atk:0.7},muro:1.09,title:'la Reina del Dolor',p:{id:'festinDolor',name:'Festín de dolor',pct:0.2,below:0.5,dmg:0.3,desc:'Todo el daño que recibes la cura un 20 %; si te queda menos del 50 %, hace +30 % de daño'},
            own:{name:'Látigo del tormento',cd:15,hits:4,mult:1,heal:0.5,desc:'4 latigazos del 100 %; se cura la mitad de lo que hace'},
            s1:{name:'Golpe de escudo II',cd:10,mult:4,desc:'400 %'},
            s2:{name:'Encanto II',cd:15,charm:4,desc:'Durante 4 s no puedes atacarla'}}},
      {id:'caballeros',name:'Caballeros infernales',where:'cueva',art:'hellknight',scene:1,
        e1:{name:'Jinete infernal',muro:1.28,p:{id:'montura',name:'Montura',at:0.5,hp:0.3,desc:'Al bajar del 50 % pierde la montura, y la bestia de lava sigue luchando aparte (30 % de su vida)'},
            s:{name:'Galope de lava',cd:12,mult:3,stun:1,desc:'300 % y aturde 1 s'}},
        e2:{name:'Vigilante del Abismo',muro:1.01,def:5,p:{id:'hermandad',name:'Hermandad',hp:0.5,desc:'Al morir aparece otro vigilante con el 50 % de vida (una vez)'},
            s:{name:'Danza de espadas',cd:10,hits:4,mult:0.8,desc:'4 tajos del 80 %'}},
        jefe:{name:'Cinder',k:{hp:0.5,atk:0.7},muro:0.85,title:'el Caballero Negro',p:{id:'inquebrantable',name:'Inquebrantable',small:0.01,dr:0.3,spd:0.6,atk:2,desc:'No se le puede congelar ni frenar; los golpes pequeños le hacen un 30 % menos; ataca un 40 % más lento pero el doble de fuerte'},
            own:{name:'Golpe partecielos',cd:20,windup:2,mult:7,desc:'Levanta la espada 2 s y descarga un 700 %'},
            s1:{name:'Galope de lava II',cd:12,mult:4,stun:1.5,desc:'400 % y aturde 1,5 s'},
            s2:{name:'Danza de espadas II',cd:10,hits:6,mult:0.9,desc:'6 tajos del 90 %'}}},
      {id:'demonios',name:'Demonios de fuego',where:'cementerio',art:'firedemon',scene:3,
        e1:{name:'Infernal',muro:1.35,p:{id:'ardiente',name:'Ardiente',pct:0.01,desc:'Mientras viva, pierdes el 1 % de tu vida por segundo'},
            s:{name:'Meteoritos',cd:12,hits:4,mult:1,desc:'4 meteoritos del 100 %'}},
        e2:{name:'Fundidor',muro:1.32,def:5,p:{id:'forja',name:'Forja',every:10,per:0.15,max:3,desc:'Cada 10 s se recalienta: +15 % de daño (hasta 3)'},
            s:{name:'Espada al rojo',cd:10,mult:3,desc:'300 %'}},
        jefe:{name:'Pyrax',k:{hp:0.6,atk:0.7},muro:1.77,title:'el Señor de la Lava',p:{id:'lago',name:'Lago de lava',every:10,per:0.005,max:5,desc:'Cada 10 s el lago sube: pierdes un 0,5 % más de vida por segundo (hasta 2,5 %)'},
            own:{name:'Martillo de magma',cd:15,mult:5,dot:{k:'quemadura',n:3},desc:'500 % y 3 quemaduras'},
            s1:{name:'Meteoritos II',cd:12,hits:6,mult:1.1,desc:'6 meteoritos del 110 %'},
            s2:{name:'Espada al rojo II',cd:10,mult:4,desc:'400 %'}}},
      {id:'caidos',name:'Caídos de las estrellas',where:'portal',art:'fallen',scene:4,
        e1:{name:'Centinela roto',muro:1.51,def:5,escort:2,p:{id:'escudoLuz',name:'Escudo de luz',every:12,sh:0.2,desc:'Cada 12 s pone a todos los enemigos un escudo del 20 % de su vida'},
            s:{name:'Lanza estelar',cd:10,mult:3,defDown:{pct:0.2,dur:6},desc:'300 % y −20 % de defensa 6 s'}},
        e2:{name:'Devorador de luz',muro:1.56,p:{id:'hambreLuz',name:'Hambre de luz',pct:0.3,desc:'Se come el 30 % de lo que te curas o ganas de escudo, y se cura lo mismo'},
            s:{name:'Tragar',cd:12,mult:2.5,shieldBreak:true,desc:'Rompe tu escudo y hace 250 %'}},
        jefe:{name:'Umbra',k:{hp:0.6,atk:0.7},muro:1.52,title:'el Primer Caído',p:{id:'formas',name:'Tres formas',at:[0.66,0.33],inv:3,dr:0.4,spd:1.5,burn:0.01,dmg:0.5,steal:0.3,desc:'Cristal (−40 % de daño recibido) · alas de hueso (ataca un 50 % más rápido y pierdes el 1 % por segundo) · luz negra (+50 % de daño y roba el 30 %); al cambiar, 3 s sin recibir daño'},
            own:{name:'Rayo de luz negra',cd:15,mult:4,noHeal:5,desc:'400 % y 5 s sin poder curarte'},
            s1:{name:'Lanza estelar II',cd:10,mult:4,defDown:{pct:0.3,dur:6},desc:'400 % y −30 % de defensa 6 s'},
            s2:{name:'Tragar II',cd:12,mult:3.5,shieldBreak:true,desc:'Rompe tu escudo y hace 350 %'}}},
    ]]},
  // ---------- campaña: oro y experiencia, sorpresas, racha, modos y sin conexión (trozo de la lista CFG) ----------
  // waveXp: experiencia extra al ganar cada oleada (en «muertes»: una oleada da 3 por sus enemigos + waveXp)
  econ:{gold:0.45,goldG:1.0198,bossGold:10,xp:4,waveXp:3,xpG:1.0389,xpReq:1300,xpReqG:1.077, xpBands:[[101,1.0,0.06],[151,1.05,1]], // nivel 100 hacia el día 8-9; xpBands: [desde nivel, crecimiento] para niveles altos
       bossScrap:{base:4,per10:2,farm:10}}, // chatarra por jefe: 4 + 2 cada 10 fases (jefe de la 150 repetido: 10), × (modo+1)
  surprise:{every:600, jitter:120, horde:{dur:30,count:2,gold:2}, wander:{dur:20,reward:{silver:1}},
    // probabilidad de cada sorpresa (sobre el total)
    // todo lo resuelve el héroe solo (juego idle: nada pide estar atento ni castiga)
    weights:{horde:50,wander:50}},
  // Racha: +pct de oro por cada 'per' muertes seguidas sin recibir golpe (máx. max); se pierde al recibir un golpe
  streak:{per:10, pct:0.01, max:0.25},
  delays:{wave:0.25,fase:0.4,defeat:0.7}, // segundos de juego entre oleadas / fases / tras perder
  phaseCap:150, // cada modo tiene 150 fases; tras vencer la 150 y evolucionar se pasa al siguiente modo
  modes:[ // locked: modo bloqueado ("Próximamente"): no se puede entrar aunque se cumplan los requisitos
          // off: oro, experiencia y cofres continúan desde la fase off · gold: multiplicador de oro · mat: material propio (uso por definir)
          // Enemigos (ver modeCurve), a partir del héroe de referencia: lo que tiene un jugador típico F2P al llegar a cada fase (simulado con tests/pace.js)
          //   ref: [[fase, mejoras de Daño, Vida y Defensa, nivel, +daño del arma]] (entre puntos, en línea recta); su evolución es la del modo
          //   golpes: [[fase, golpes]] los que necesita ese héroe para tumbar a un enemigo normal (vida = su daño × golpes)
          //   aguante: [[fase, golpes]] los golpes de un enemigo normal que aguanta ese héroe (su ataque sale de esto, la vida y la defensa del héroe); tests/equilibrio/ajustar-normales.js
    {name:'Normal',off:0,gold:1,mat:'Esencia', aguante:[[1,52],[5,52],[15,52],[25,52],[35,52],[45,52],[55,52],[65,52],[75,52],[85,52],[95,52],[105,52],[115,58],[125,68.3],[135,78],[145,80.3]],
      ref:[[1,0,1,0.06],[30,13,23,0.12],[60,41,44,0.17],[90,72,68,0.19],[120,101,88,0.22],[150,136,150,0.25]],
      golpes:[[1,2.27],[15,2.4],[30,2.95],[45,3.18],[60,3.48],[75,3.74],[90,4.06],[105,4.8],[120,6.48],[135,7.3],[150,8.46]]},
    {name:'Pesadilla',off:149,gold:1.5,mat:'Esencia de pesadilla', aguante:[[1,44],[5,44],[15,44],[25,44],[35,44],[45,46.6],[55,53.3],[65,51.7],[75,49.8],[85,49.8],[95,47],[105,46.1],[115,51.3],[125,56.9],[135,52.2],[145,44]],   // abierta: simulado, se entra el día 12-19 y se acaba el 23-43
      ref:[[1,158,155,0.30],[30,176,233,0.40],[60,194,258,0.40],[90,216,286,0.40],[120,239,300,0.40],[150,254,300,0.40]],
      golpes:[[1,9.31],[15,8.82],[30,8.53],[45,9.56],[60,10.73],[75,11.49],[90,12.32],[105,13.33],[120,14.44],[135,17.43],[150,21.03]]},
    {name:'Infierno',off:298,gold:2.25,mat:'Esencia infernal', aguante:[[1,27],[5,27],[15,28.9],[25,34.6],[35,36],[45,42.7],[55,49.3],[65,45.3],[75,47],[85,52.7],[95,47],[105,38.1],[115,35.6],[125,33.7],[135,34.3],[145,41.5]],
      ref:[[1,273,302,0.40],[30,301,360,0.54],[60,323,387,0.72],[90,345,414,0.72],[120,354,431,0.72],[150,392,467,0.72]],
      golpes:[[1,28.46],[15,24.54],[30,21.28],[45,21.11],[60,21.05],[75,22.19],[90,23.43],[105,29.07],[120,36.09],[135,31.6],[150,27.73]]},
  ],
  offlineMinMeasure:30, // sin conexión: se usa el DPS medido cuando ya se han medido ataques por valor de 30 golpes de tu daño
  offlineCapH:3, offlineVipH:8, offlineAdMult:1.5, offlineAdPerDay:2, // horas de farmeo sin conexión (VIP); extra de oro con anuncio al llenar el tope, 2 veces por día
  // ---------- objetos: rarezas, armas, stats, nombres, cofres y materiales (trozo de la lista CFG) ----------
  rar:['C','U','R','E','L','M'],
  rarName:{C:'Común',U:'Poco común',R:'Rara',E:'Épica',L:'Legendaria',M:'Mítica'},
  weapon:{ // daño%, velocidad%, nº stats
    C:[0.06,0.02,1],U:[0.11,0.036,2],R:[0.20,0.065,2],E:[0.36,0.12,3],L:[0.65,0.21,3],M:[1.0,0.32,4],
    invMax:50, // inventario: como mucho 50 armas (la equipada no cuenta: va en el Equipo); para abrir cofres hacen falta huecos libres
    lvlPct:0.25,maxLvl:5, // nv5 = ×2 del base: una nv5 supera un poco a la siguiente rareza nv1; nivel N -> N+1 cuesta N armas iguales + chatarra
    scrapLvl:{C:0,U:10,R:30,E:60,L:120,M:240},
    scrapDis:{C:2,U:5,R:15,E:40,L:100,M:250},
    // Ascender: arma al nivel máximo + otra igual (misma clase y rareza) también al máximo → rareza siguiente al nivel 2 (sus stats se reescalan
    // a la nueva rareza y gana los huecos que le falten). mats: [Esencia, Esencia de pesadilla, Esencia infernal]. M (Mítica) es el tope.
    // copias que faltan para subir de nivel (Rara o mejor): cada una se puede pagar con material [Esencia, Esencia de pesadilla, Esencia infernal]
    copyMat:{R:[0,8],E:[0,20],L:[0,50,4],M:[0,120,10]}, copyScrap:{R:400,E:2000,L:6000,M:15000}, // + chatarra por cada copia pagada con material
    ascend:{lvl:2, C:{scrap:50}, U:{scrap:300,mats:[2]}, R:{scrap:4000,mats:[0,10]}, E:{scrap:12000,mats:[0,30]}, L:{scrap:30000,mats:[0,60,10]}},
    // efecto de las armas Legendarias (y Míticas) de cada clase. SIN BALANCEAR.
    legend:{
      Guerrero:{id:'tajo', name:'Tajo partido', mult:0.5, desc:'Sus golpes dan también al enemigo de detrás (50 %)'},
      Mago:{id:'vacio', name:'Vacío', ignoreDf:0.3, desc:'Sus golpes ignoran el 30 % de la defensa'},
      Arquero:{id:'rafaga', name:'Ráfaga', every:4, arrows:2, desc:'Cada 4.º disparo son 2 flechas'},
      Asesino:{id:'filoVacio', name:'Filo del vacío', desc:'Los críticos ignoran toda la defensa'},
      Clerigo:{id:'llamarada', name:'Llamarada solar', every:5, pct:0.2, dur:3, desc:'Cada 5.º golpe quema a todos (20 % por s, 3 s)'}},
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
    silver:{name:'Plata',from:'Tienda (oro)',goldMin:5,perDay:null,step:0.1}, // precio: el oro de 5 min farmeando tu récord, +10 % por cada compra del día (vuelve al base cada día); sin límite
    mode:{name:'Modo',from:'Tienda',price:100}, // 100 tokens (1 $)
  },
  startWeapon:'C',
  matDrop:{from:10,to:150,c0:0.01,c1:0.05,max0:1,max1:3,sure:[50,100]}, // sure: esos jefes de élite dan 1 esencia segura la primera vez (para el Grimorio) // todos los jefes sueltan esencia del modo: 1 % (1) en la fase 10 → 5 % (1-3) en la 150 (el de la 150 se puede farmear)
  matShop:{ess:50, ev:25}, // tienda: Esencia 50 tokens, Emblema 25 tokens
  // ---------- economía: tokens, pagos, ofertas, tienda, potenciadores, liga, tarjeta y VIP (trozo de la lista CFG) ----------
  // Tokens = dinero: 100 tokens = 1 $. Dos saldos: comprados (no se retiran) y ganados en los pools (se pueden retirar).
  // Al gastar se usan primero los comprados. Compras y retiros SIMULADOS hasta que haya servidor y pasarela de pago.
  // open: se pueden comprar tokens (poner a true al conectar Telegram Stars); mientras, lo que se paga con tokens sale "Próximamente"
  // Paquetes de tokens con descuento por cantidad: bonus = tokens de regalo (500: +5 %, 1000: +10 %, 2500: +20 %).
  // Reparto de cada compra (en valor de tokens a precio base, 2 tokens por Star): 30 % para ti; el 70 % restante vuelve a
  // los jugadores = regalo del paquete + lo que va al bote (bote = 70 % − regalo). Así el descuento sale del bote, no de tu 30 %.
  tokens:{perUsd:100, open:true, packs:[100,500,1000,2500], bonus:{500:25,1000:100,2500:500}, keep:0.3, withdraw:{fee:0.15, min:100}}, // retiro: solo en pruebas locales (desactivado en Telegram)
  // Comprar tokens con TON / USDT (función "crypto"; sin retiros). on:true cuando el secreto TON_ADDRESS esté puesto en Supabase.
  crypto:{on:false, url:'https://xdtxdaywotkppzssrjni.supabase.co/functions/v1/crypto', manifest:'https://zekkon24.github.io/idle-ascension/tonconnect-manifest.json'},
  // Pagos con Telegram Stars (función "pay" del servidor; el precio que manda es el del servidor). 100 tokens = 50 Stars.
  stars:{url:'https://xdtxdaywotkppzssrjni.supabase.co/functions/v1/pay', perToken:0.5,
    first:{stars:50, r:'U', tokens:150, silver:5},   // oferta de bienvenida: una sola vez
    pass:{stars:250}},
  // Ofertas en el momento justo (se pagan con Stars; duran 'dur' horas y no vuelven a salir hasta pasadas 'cool' horas)
  //  wall: el mismo élite/JEFE de la campaña te ha ganado 'deaths' veces seguidas · evo: tienes el nivel para evolucionar pero te faltan materiales · inv: inventario lleno
  offers:{dur:24, cool:72,
    wall:{stars:100, t:'Rompe el muro', b:{mode:3,silver:10}, deaths:5},
    evo:{stars:100, t:'Pack de evolución', b:{ess:3,ev:12}},
    inv:{stars:100, t:'Inventario +25', inv:25, max:2}},
  shopTab:true, // pestaña Tienda en la barra de abajo
  boosts:{ // potenciadores por anuncios (cada uso pide 'ads' anuncios; 'perDay' usos al día)
    speed:{ads:2,min:15,mult:2,perDay:3}, // combate ×2 durante 15 min reales (se acumula si ya está activo)
    gold:{ads:2,hours:1,earlyHours:0.5,earlyUntil:50,perDay:3}, // oro de 1 h farmeando tu fase récord (30 min hasta pasar la fase 50)
  },
  // Liga mensual (SIMULADA: sin dinero real). Bote = 70 % de todos los tokens gastados en el mes. Se reparte entre TODOS los
  // jugadores según sus puntos del mes: 1 por token gastado, 1 por anuncio visto (≈3× lo que genera: ~0,3 tokens) y
  // 0,5 por hora de oro generado (oro ÷ lo que da 1 h farmeando tu récord). Premio en tokens ganados (retirables), el día 1 a la 01:00 UTC.
  // Mientras no haya servidor: 99 rivales que gastan rivalSpend tokens/día y juegan rivalPlay puntos/día (14 anuncios + ~14 h de oro).
  // show:false = Liga oculta por ahora (se implementará aparte); los puntos se siguen contando
  league:{show:false, share:0.7, ptsToken:1, ptsAd:1, ptsGoldHour:0.5, rivals:99, rivalSpend:50, rivalPlay:21},
  cardGold:0.2, cardPrice:500, vipSpeed:1.5, vipPrice:1000, // Tarjeta mensual (+20 % de oro) y VIP (combate ×1,5, 8 h sin conexión), 30 días, en tokens
  // ---------- premios: misiones, calendario, pase, ruleta y socios (trozo de la lista CFG) ----------
  // Misiones diarias (se renuevan cada día): cada una da oro (minutos de farmeo de tu récord) y experiencia del pase
  missions:{list:[
      // rew: premio de cada misión (gold = minutos de farmeo de tu récord). Entre todas: oro de 4 h, 3 madera, 1 plata (la de anuncios), 1 ticket.
      // La más fácil (enemigos) solo da XP del pase. Todas dan xp del pase.
      {k:'ad',n:5,t:'Mira 5 anuncios',rew:{silver:1}},
      {k:'event',n:1,t:'Juega la Mazmorra o el Jefe semanal',rew:{gold:60,wood:1,ticket:1}},
      {k:'chests',n:5,t:'Abre 5 cofres',rew:{gold:60,wood:1}},
      {k:'upgrade',n:10,t:'Compra 10 mejoras',rew:{gold:60,wood:1}},
      {k:'pvp',n:3,t:'Juega 3 PvP',rew:{gold:60}},
      {k:'kills',n:300,t:'Derrota 300 enemigos',rew:{}}],
    xp:20, bonus:{gold:60,silver:1,wood:2}, // bonus: al recoger todas las diarias del día
    // Misiones semanales (de lunes a domingo). Entre todas: oro de 6 h, 5 madera, 2 plata (la de anuncios), 1 ticket.
    weekly:{list:[
      {k:'ad',n:30,t:'Mira 30 anuncios',rew:{silver:2}},
      {k:'event',n:5,t:'Juega 5 veces la Mazmorra o el Jefe semanal',rew:{gold:70,wood:1}},
      {k:'alldays',n:7,t:'Completa todas las misiones diarias cada día',xp:120,rew:{gold:150,wood:2,ticket:1}},   // la que más da (un día cuenta al recoger las 5 diarias)
      {k:'chests',n:25,t:'Abre 25 cofres',rew:{gold:70,wood:1}},
      {k:'upgrade',n:60,t:'Compra 60 mejoras',rew:{gold:70,wood:1}},
      {k:'kills',n:5000,t:'Derrota 5.000 enemigos',rew:{}}],
      xp:40, bonus:{gold:120,silver:3}}}, // bonus: al recoger todas las semanales
  // Calendario de 7 días: un premio por cada día que entras (no hace falta seguidos); tras el 7.º vuelve a empezar
  calendar:[{gold:30,wood:2},{silver:2},{ess:1,wood:2},{silver:3},{ev:2,wood:3},{silver:5},{mode:1}],
  // Pase de temporada: 30 días, 50 niveles de 85 XP (diarias 100 XP/día + semanales 320 XP/semana ≈ nivel 50 hacia el día 29).
  // Línea gratis y línea de pago (Stars). Nivel 50: arma Rara (gratis) y Épica (pago). Pago: 60 tokens cada 10 niveles (300 = 3 $).
  pass:{days:30, levels:50, xp:85, item:{free:'R',prem:'E'}, tok:{every:10,n:60}},
  // Ruleta diaria: 1 tirada gratis al día + 1 con anuncio. w = peso (probabilidad relativa)
  wheel:[{b:{gold:30},w:20},{b:{gold:60},w:15},{b:{gold:180},w:6},{b:{wood:1},w:15},{b:{wood:2},w:10},{b:{wood:3},w:5},
    {b:{silver:1},w:8},{b:{ticket:1},w:6},{b:{ess:1},w:5},{b:{ev:3},w:8},{b:{mode:1},w:2}],
  // buyPct 0: el % de las compras del amigo está desactivado hasta tener pagos reales (lo da el servidor)
  referral:{link:'https://t.me/IdleAscensionTestBot/game', goalFase:50, goalSilver:3, buyPct:0, giftSilver:1}, // enlace de la mini app (t.me/<bot>/<app>); premios (los da el servidor: supabase/functions/track)
  // ---------- modos: desbloqueo, Sala de jefes, Mazmorra, jefe semanal y PvP (trozo de la lista CFG) ----------
  // Desbloqueo de modos: fase récord (en Normal; desde Pesadilla, todo abierto) o días de juego (desde que empezó la partida).
  // POR AHORA TODO ABIERTO (unlock vacío). Antes de lanzar: unlock = unlockPlan.
  unlock:{}, unlockPlan:{lab:{fase:10}, pvp:{fase:50}, tower:{fase:50}, boss:{day:7}},
  // Sala de jefes: cada JEFE de campaña vencido (fases 30, 60, 90, 120 y 150 de cada modo) se puede volver a luchar. 3 intentos al día (se gastan al empezar).
  // 3 estrellas: ★ como en la campaña; ★★ y ★★★ más fuertes (hay que pasar la anterior). 1.ª victoria de cada estrella: 'first';
  // repetir: 'repeat' (oro de X min y chatarra del jefe ×N). Con 5 JEFES por modo, ★★ sin esencia y ★★★ con 2 (unas 10 por modo, como con 3)
  // Sala de jefes: sin tiempo límite; desde el segundo 60 el jefe se enfurece cada 10 s (×1,2 velocidad, ×1,1 ataque)
  hall:{rage:{from:60,every:10,spd:1.2,atk:1.1}, tries:3, stars:[{hp:1,atk:1},{hp:3,atk:1.6},{hp:8,atk:2.5}],
    every:30, // solo los JEFES (fases 30, 60, 90, 120 y 150 de cada modo); entran al vencerlos en la campaña
    first:[{silver:2,ev:2},{silver:3,ev:3},{mode:1,ev:5,ess:2}],
    repeat:[{gold:30,scrap:2},{gold:45,scrap:3},{gold:60,scrap:4}]},
  event:{ // Mazmorra (diaria): infinita, monstruos sin parar hasta que mueres; ranking por muertes; 1 entrada gratis al día, las demás con ticket
    // cada ramp.every s sube de nivel: +ramp.group monstruos por grupo, salen más a menudo (×spawn), andan más rápido (×walk) y pegan más rápido (+spd)
    // máximo maxDur s reales (3 min): si sigues vivo, el intento acaba ahí. Desde speedFrom s el combate se acelera
    // ×(1 + speedUp·(t − speedFrom)): ×3,4 a los 3 min, unos 5:24 de juego (los más fuertes del día 60 aguantan ≈ 3:30 de juego)
    dur:0, maxDur:180, speedFrom:60, speedUp:0.02, ramp:{every:15, group:0.5, groupMax:12, spawn:0.95, spawnMin:0.5, walk:0.95, walkMin:0.25, spd:0.06},
    spawnEvery:1.2, walk:0.6, group:3, groupHp:0.6, groupGap:0.3, groupAtk:0.25, // grupos de 3 monstruos con ×0,6 de vida; llegan cada 0,3 s y pegan un 75 % menos (casi siempre mueres por acumularse, no de un golpe)
    back:100, atkBack:200, // empieza 100 fases por debajo de tu récord en tu modo (cada grupo, una fase más); su ataque es el de 200 fases antes: cuenta limpiar a tiempo
    maxAlive:30, // como mucho 30 monstruos vivos a la vez (el siguiente grupo espera): el móvil va fluido y aguantar más no da más muertes si no limpias
    ticketCost:100, // ticket extra en la tienda (tokens); las muertes de varios intentos del día se suman
    mat:'Emblema', pauseH:1, // pausa de 00:00 a 01:00 UTC: se terminan los intentos a medias y a la 01:00 se reparten los premios
    rivals:99, spread:0.35, rivalExtra:[0.2,0.06], rivalBase:0.5, // prob. de que un rival haga un 2º y un 3er intento; rivalBase: rivales al 50 % de la curva, así el jugador medio queda hacia el puesto 10-20 (emblemas para evolucionar hacia el día 11-12, como antes de la Mazmorra nueva)
                          // rivales simulados: jugador medio de tus mismos días × dispersión
    curve:[[1,324],[2,356],[3,354],[5,441],[7,471],[10,461],[13,420],[15,408],[17,445],[20,502],[25,501],[30,463],[35,423],[40,468],[45,532],[50,602],[60,692]], // [días de juego, muertes del jugador medio] (simulaciones de ritmo: 5 clases × A/B × 5 semillas; media de 6 días, que es lo que tardan en rotar los modificadores; baja un poco al cambiar de modo, porque la Mazmorra empieza por tu récord del modo nuevo)
    // modificador del día (rota cada día, igual para todos): cambia las reglas con algo a cambio. score: cuánto mueve las muertes
    // (medido con simulación); los rivales simulados se multiplican por lo mismo para que el ranking siga siendo justo
    affixes:[
      {id:'furia',name:'Furia',desc:'Los monstruos llegan y pegan más rápido, pero tienen −25 % de vida',walk:0.7,spd:1.3,hp:0.75,score:1.05},
      {id:'enjambre',name:'Enjambre',desc:'+2 monstruos por grupo, cada uno con −40 % de vida y −30 % de daño',group:2,hp:0.6,atk:0.7,score:1.05},
      {id:'certero',name:'Golpe certero',desc:'+20 % de crítico, pero los monstruos tienen +15 % de vida',cr:0.2,hp:1.15,score:0.96},
      {id:'sinCura',name:'Sin curación',desc:'No te curas de ninguna forma, pero los monstruos pegan −35 %',noHeal:true,atk:0.65,score:1.04},
      {id:'gigantes',name:'Gigantes',desc:'Grupos con 1 monstruo menos, con +40 % de vida y −20 % de daño',group:-1,hp:1.4,atk:0.8,score:0.74},
      {id:'vampiros',name:'Sangre',desc:'+10 % de robo de vida, pero los monstruos pegan +30 %',ls:0.1,atk:1.3,score:1.01},
    ],
    milestones:{every:50,ch:'wood',big:200,bigCh:'silver'}, // premio personal: cada 50 muertes del día 1 cofre de madera; cada 200, además 1 de plata
    rewards:[                                     // premio según tu puesto del día (se cobra al día siguiente)
      {to:1,em:5,ch:'mode',n:1},{to:3,em:4,ch:'mode',n:1},{to:10,em:3,ch:'silver',n:2},
      {to:25,em:2,ch:'silver',n:1},{to:50,em:1,ch:'wood',n:2},{to:100,em:1,ch:'wood',n:1}],
  },
  wboss:{ // Jefe semanal: 1 min contra un jefe inmortal; ranking semanal por daño (se suman los intentos); 1 entrada gratis a la semana, las demás con Ticket Jefe
    dur:60, rampTo:300, atkMult:2,                // es como un jefe de la fase n (n sube de 1 a rampTo durante el minuto: sus esbirros crecen) × atkMult
    noHurt:true,                                  // no te pega (ni él ni sus esbirros; sus mecánicas no te quitan vida): es un reto de daño de 1 minuto, siempre llegas al final
    ticketCost:150,                               // Ticket Jefe en la tienda: 150 tokens
    // jefe de la semana: rota cada semana entre los 5 JEFES de tu modo (CFG.zones), con su pasiva y sus habilidades. Como no
    // muere, lo que salta al bajar de vida salta con el tiempo (a los 30 s es como si estuviera al 50 %). minion: sus esbirros
    // (vida y ataque × los del jefe de ese momento). score: cuánto mueve el daño (1 hasta medirlo con simulaciones)
    minion:{hp:0.6,atk:0.4}, score:1,
    rivals:99, spread:0.4, rivalExtra:[0.15,0.05], rivalBase:0.75, // rivales medidos a mitad de semana; así el jugador medio queda hacia el puesto 50
    curve:[[1,4800],[2,6600],[3,10300],[5,19700],[7,33200],[10,51600],[13,214800],[15,364400],[17,505400],[20,667300],[25,870700],[30,1377100],[35,3606000],[40,10996600],[45,16400200]], // [días de juego, daño del jugador medio en una pelea] (tests/pace.js con WBCAL: 5 clases × A/B × 2 semillas, media de los días d−1 a d+1; medida con el jefe sin daño)
    rewards:[                                     // premio según tu puesto de la semana (lunes 01:00 UTC)
      // ×3 del premio diario de la Mazmorra en el mismo puesto (solo hay uno por semana); los cofres de madera
      // se cambian por plata de valor parecido (2 de madera ≈ 1 de plata) para que el premio luzca
      {to:1,em:15,ch:'mode',n:3},{to:3,em:12,ch:'mode',n:3},{to:10,em:9,ch:'silver',n:6},
      {to:25,em:6,ch:'silver',n:3},{to:50,em:3,ch:'silver',n:3},{to:100,em:3,ch:'silver',n:2}],
  },
  // PvP asíncrono: duelo al mejor de 3 contra la copia de otro jugador o un «fantasma» (rival generado a tu nivel).
  // Antes de cada ronda eliges 1 de 3 cartas (mejoras de la Torre, se acumulan en el duelo). Ronda: hasta 'round' s (si nadie
  // cae, gana quien tenga más % de vida). Estadísticas mezcladas: tu^mix × media^(1−mix). Liga semanal con puntos tipo ELO (k).
  // PvP: combate contra el fantasma de otro jugador (su partida al 100 %, la maneja la IA). Elo para pocos jugadores:
  // K alto (kNew) en las primeras newGames partidas y luego k; al defensor le cambia la mitad (defK). SIN BALANCEAR.
  // maxT: segundos máximos del combate (si nadie cae, gana quien tenga más % de vida). botSpread: puntos del bot ± este valor.
  // ttk: la vida de los dos en el duelo se multiplica igual, para que solo con ataques normales se tarde ~ttk s (con habilidades, menos)
  // cls: multiplicador del daño que hace cada clase en PvP. Calibrado (días 4-60, mejoras al azar) para ganar de media:
  // Mago 55 %, Asesino 52 %, Arquero 50 %, Clérigo 48 %, Guerrero 45 % (el Mago tiene ventaja: es su modo)
  // Rival: el jugador más cercano en puntos, sin repetir ninguno de tus últimos 'recent' duelos (lo decide el servidor)
  // free: duelos gratis al día; después 1 ticket PvP por duelo (paquete de 'pack' tickets por 'packCost' tokens = 1 $)
  // rewards: premio del ranking semanal según tu puesto (igual que el Jefe semanal); lo reparte el servidor el lunes y los puntos
  // quedan a medio camino de 1000. leagues: insignia según los puntos ([desde, nombre, color])
  pvp:{free:3, pack:3, packCost:100, recent:5, maxT:30, speedUp:0.1, // duelo de 30 s (reales) que se acelera: a los t s va a ×(1 + 0,1·t); solo se gana por K.O., si nadie cae es empate; habilidades siempre automáticas
    rewards:[{to:1,em:15,ch:'mode',n:3},{to:3,em:12,ch:'mode',n:3},{to:10,em:9,ch:'silver',n:6},{to:25,em:6,ch:'silver',n:3},{to:50,em:3,ch:'silver',n:3},{to:100,em:3,ch:'silver',n:2}],
    leagues:[[0,'Bronce','#c07a45'],[1100,'Plata','#b9c0cc'],[1300,'Oro','#e8b04a'],[1500,'Diamante','#6fc7e8'],[1700,'Leyenda','#c86bff']], ttk:[34.1,44,49.4], heal:0.2, reflect:0.5, freeze:0.1, forma:0.15,
    // PvP equilibrado con simulaciones (héroes con el nivel, arma y mejoras típicos de cada etapa: sin evolucionar 60-150, 1.ª 150-300, 2.ª 300-500):
    // ttk: duración buscada por evolución [sin evolucionar, 1.ª, 2.ª] (duelos de unos 15 s). heal: en PvP se cura × esto. reflect: espinas y Onda de escudo × esto.
    // freeze: congelar dura × esto en PvP (si no, el que congela deja al otro sin atacar). forma: «el día» de cada uno, su daño en el duelo × 1 ± forma al azar
    // (los duelos son casi deterministas: sin esto, un 5 % de ventaja gana siempre)
    // cls: fuerza de cada clase y etapa del kit en PvP (× el daño que hace; entre ×0,6 y ×1,4, de node tests/equilibrio/ajustar-pvp.js): contra las de
    // su evolución gana sin evolucionar ~50 %, el camino de área (A) ~42 % y el de un objetivo (B) ~58 %. Con algo más de equipo se gana el 95-100 %.
    // vs (ajuste por pareja) y skill (daño de las habilidades por clase) ya no hacen falta con los héroes iguales: vacíos.
    skill:{},
    vs:{},
    // Asesino: base, B1 y B2 ×1,02 a mano sobre lo calculado (petición: un poco más fuerte en PvP)
    cls:{Guerrero:{base:0.979,A1:0.645,B1:0.772,A2:0.741,B2:0.894},Mago:{base:1.069,A1:1.13,B1:1.796,A2:1.102,B2:1.575},Arquero:{base:1.064,A1:1.132,B1:0.857,A2:1.219,B2:0.969},Asesino:{base:1.073,A1:1.267,B1:0.774,A2:1.259,B2:0.776},Clerigo:{base:0.854,A1:0.957,B1:1.11,A2:0.778,B2:0.987}}, start:1000, k:24, kNew:40, newGames:10, defK:0.5, botSpread:60, near:5},
  // ---------- Torre (trozo de la lista CFG) ----------
  // Torre (roguelike): mapa de pisos con caminos; entras con tu héroe y sumas mejoras de cualquier clase durante la partida.
  // 3 vidas por partida (perder un combate = −1 vida y repites el piso); vida extra con tokens. Enemigos: los de tu fase récord
  // × hp0·hpG^(piso−1) de vida y × atk0·atkG^(piso−1) de ataque. Premios la 1.ª vez que llegas a cada piso.
  // Base de los enemigos = (los de tu fase récord)^w × (los «a tu medida»)^(1−w): con w bajo, tus estadísticas pesan poco.
  // «A tu medida»: tardas tKill s en matar a uno normal y cada golpe suyo te quita hitPct de tu vida (en el piso 1).
  // Crecimiento por tramos: curve=[[desde piso, ×vida por piso, ×ataque por piso], …] (suave hasta el 50, duro hasta el 100, muy duro después).
  tower:{lives:1, lifeCost:50, w:0.35, tKill:1.0, hitPct:0.0107, curve:[[1,1.03,1.015],[30,1.06,1.03],[60,1.08,1.04]], hp0:0.75, atk0:0.8, count0:4, countEvery:5, countMax:10, group:3,
    zoneK:{boss:{hp:0.75,atk:0.6}, elite:{atk:0.75}},   // élites y JEFES de zona en la Torre: su vida y ataque × esto (sus habilidades ya pegan; simulado: piso mediano 50-55)
    // Élite: 3 enemigos con, entre todos, elite.hp × la vida de un combate normal; JEFE: el doble que el élite (vida y daño) + mecánica
    elite:{n:3,hp:1.3,atk:1.2}, boss:{every:10,hp:2.6,atk:2.4},
    // saltos de dificultad: desde 'from' los élites se hacen mucho más duros (×eliteUp cada 'every' pisos); cada 'jumpEvery' pisos
    // todo sube de golpe (×jump)
    hard:{eliteFrom:40, eliteEvery:10, eliteUp:1.25, bossUp:1.25, jumpEvery:25, jump:1.15},
    // Mapa (reglas de Slay the Spire con 2 rutas, por tramos de 10 pisos): % de cada casilla libre (combate el resto), 3 primeros pisos
    // del tramo sin élite ni hoguera (calm), cofres en el piso treasureAt, élites obligatorios desde mergeFrom (piso mergeAt y un merge % de los demás)
    // unk: la casilla «?» es combate / tienda / cofre con [base, +si no sale]; si no, evento (como en StS)
    route:{lanes:3, fork:3, // 3 caminos; cada 3 pisos del tramo (3, 6 y 9) hay cruce: puedes pasar al camino de al lado
      pct:{fight:53,event:22,rest:12,elite:13,shop:5}, calm:3, treasureAt:6, mergeAt:5, mergeFrom:15, merge:0.08, unk:{m:[0.10,0.10],s:[0.03,0.03],t:[0.02,0.02]}},
    // Torre = roguelike puro: tu personaje NO cuenta (ni nivel, arma, mejoras, evolución ni grimorio). Todos empiezan con este
    // héroe único y solo se hacen fuertes con las mejoras de la partida. Los enemigos tampoco dependen de tu cuenta.
    hero:{hp:1000,atk:100,df:20,spd:1,cr:0.05,cd:0.5}, foeDf:10,
    // Piso final: el jefe del piso 100 tiene vida infinita. Se le pega hasta caer; el daño hecho va al ranking.
    // Se enfurece: su ataque sube ×rage cada 'every' s.
    maxFloor:100, final:{atk:1.6, every:10, rage:1.2},
    enrage:{after:60, every:5, mult:1.15},
    speed:0.8, endDelay:1.6,   // los combates de la Torre van al 80 % de velocidad y, al matar a todos, se espera 1 s antes de salir (élite y jefe: hasta elegir la recompensa)   // en cualquier combate de más de 60 s, los enemigos pegan un 15 % más cada 5 s
    // almas: moneda de la partida (solo para los eventos ?). Combate normal / élite / jefe
    souls:{fight:10,elite:5,boss:20},
    // 1 vida (permadeath): al morir se puede revivir UNA vez por partida viendo un anuncio (con revHp de vida)
    revHp:0.5,
    // rasgos de los élites: cada uno saca 1-2 al azar (+1 con la maldición «rasgo»)
    traits:{rapido:{name:'Rápido',desc:'Ataca un 40 % más rápido',spd:1.4}, regenera:{name:'Regenera',desc:'Recupera el 3 % de su vida cada segundo',regen:0.03}, escudo:{name:'Escudo',desc:'Empieza con un escudo del 30 % de su vida',shield:0.3}, espinas:{name:'Espinas',desc:'Cada golpe que le das te devuelve el 20 % de uno de sus golpes',reflect:0.2},
      furioso:{name:'Furioso',desc:'Bajo el 50 % de vida pega un 50 % más',below:0.5,atk:1.5}, gigante:{name:'Gigante',desc:'El doble de vida, pero más lento',hp:2,spd:0.75}},
    // jefes: la mecánica rota cada 10 pisos (invocador, enfurecido, escudo de fases)
    bossMech:{order:['invocador','enfurecido','fases'], desc:{invocador:'Cada 10 s llama a un esbirro',enfurecido:'Bajo el 50 % de vida pega el doble y va más rápido',fases:'Al 66 % y al 33 % de vida se vuelve invulnerable 3 s y se cura un 10 %',final:'Vida infinita: aguanta todo lo que puedas. Cada 10 s pega un 20 % más. Tu daño va al ranking'}, invocador:{every:10,n:1}, enfurecido:{below:0.5,atk:2,spd:1.5}, fases:{at:[0.66,0.33],inv:3,heal:0.1}},
    // eventos ?: id → coste/efecto
    events:{fuente:{hp:0.2}, mercader:{cost:30}, trampa:{good:0.6,hp:0.25}, santuario:{cost:25,heal:0.4}, altar:{}},   // los eventos de la casilla «?» (el altar maldito ahora sale aquí)
    // maldiciones (altar maldito: recibes 1 grimorio legendario al azar y una maldición al azar)
    curses:{vida:{name:'Enemigos más fuertes',desc:'Los enemigos tienen +20 % de vida',hp:0.2}, fragil:{name:'Frágil',desc:'−15 % de vida máxima',hp:-0.15},
      rasgo:{name:'Élites temibles',desc:'Los élites traen un rasgo más'}},
    rewards:[{every:50,b:{mode:1}},{every:25,b:{silver:1}},{every:5,b:{wood:1}}],
    // CARTAS (multiusos) y GRIMORIOS (deciden la build). Calidades: C común, R rara, E épica, L legendaria (solo grimorios).
    // fam: familia (solo etiqueta) f Fuerza y Crítico · e Escudo y Espinas · s Sangre · '' neutra
    // type: stat (número) · skill (activa con recarga, se lanza sola; 1 de cada, hasta maxSkills) · fx (efecto con condición) · pas (pasiva que cambia reglas)
    // Las cartas stat/fx se acumulan si se repiten; las skill y los grimorios, solo 1 de cada.
    maxSkills:8, shieldDecay:0.12, shieldMax:1,   // el escudo se gasta un 12 % por segundo (salvo Barricada) y no pasa de tu vida máxima
    // probabilidad de cada calidad: élite (1 de 3, cartas y grimorios) · cofre (1 grimorio) · tienda (4 cartas y 2 grimorios) · eventos
    rarity:{elite:{C:50,R:33,E:17}, chest:{C:50,R:33,E:17}, shop:{C:50,R:33,E:15,L:2}, trap:{C:50,R:33,E:17}},
    shop:{cards:4, grims:2, price:{c:{C:20,R:35,E:60}, g:{C:40,R:70,E:100,L:150}}, remove:30, removeUp:15},
    cards:{
      fuerza:{r:'C',fam:'f',type:'stat',name:'Fuerza',desc:'+18 % de daño',atk:0.18},
      rapidez:{r:'C',fam:'f',type:'stat',name:'Rapidez',desc:'+15 % de velocidad de ataque',spd:0.15},
      precision:{r:'C',fam:'f',type:'stat',name:'Precisión',desc:'+12 % de crítico y +45 % de daño crítico',cr:0.12,cd:0.45},
      aguante:{r:'C',fam:'e',type:'stat',name:'Aguante',desc:'+15 % de vida máxima',hp:0.15},
      armadura:{r:'C',fam:'e',type:'stat',name:'Armadura',desc:'+30 % de defensa',df:0.30},
      puas:{r:'C',fam:'e',type:'stat',name:'Púas',desc:'Devuelves el 25 % del daño que recibes',reflect:0.25},
      vampiro:{r:'C',fam:'s',type:'stat',name:'Vampiro',desc:'5 % de robo de vida',ls:0.05},
      regen:{r:'C',fam:'s',type:'stat',name:'Regeneración',desc:'Recuperas el 0,5 % de tu vida por segundo',regen:0.005},
      tGolpe:{r:'C',fam:'f',type:'skill',name:'Golpe fuerte',desc:'Golpe del 220 % (cada 8 s)',cd:8,mult:2.2},
      tMuro:{r:'C',fam:'e',type:'skill',name:'Muro',desc:'Escudo del 15 % de tu vida (cada 15 s)',cd:15,shield:0.15},
      tSangria:{r:'C',fam:'s',type:'skill',name:'Sangría',desc:'Pierdes el 10 % de tu vida: tus 3 próximos golpes hacen +100 % (cada 12 s)',cd:12,cost:0.10,hits:3,mult:1},
      aliento:{r:'C',fam:'s',type:'fx',name:'Segundo aliento',desc:'Al ganar un combate te curas el 15 %',heal:0.15},
      doble:{r:'R',fam:'f',type:'stat',name:'Golpe doble',desc:'30 % de probabilidad de golpear dos veces',dbl:0.3},
      talisman:{r:'R',fam:'e',type:'stat',name:'Talismán',desc:'Recibes un 20 % menos de daño',taken:0.20},
      sanguijuela:{r:'R',fam:'s',type:'stat',name:'Sanguijuela',desc:'+10 % de robo de vida',ls:0.10},
      tTorbellino:{r:'R',fam:'f',type:'skill',name:'Torbellino',desc:'130 % a todos los enemigos (cada 12 s)',cd:12,mult:1.3},
      tBaluarte:{r:'R',fam:'e',type:'skill',name:'Baluarte',desc:'8 s con +50 % de defensa y devuelves el 100 % del daño (cada 30 s)',cd:30,dur:8,df:1.5,reflect:1},
      tSed:{r:'R',fam:'s',type:'skill',name:'Sed de sangre',desc:'Pierdes el 20 % de tu vida: escudo de la mitad y +30 % de robo de vida 10 s (cada 28 s)',cd:28,cost:0.2,shield:0.5,ls:0.3,dur:10},
      ejecutor:{r:'R',fam:'f',type:'fx',name:'Ejecutor',desc:'+80 % de daño a los enemigos por debajo del 50 % de vida',below:0.5,mult:0.8},
      escudoReg:{r:'R',fam:'e',type:'fx',name:'Escudo regenerable',desc:'Cada 10 s ganas un escudo del 10 % de tu vida',every:10,shield:0.10},
      titan:{r:'E',fam:'',type:'stat',name:'Titán',desc:'+20 % de daño y +20 % de vida',atk:0.2,hp:0.2},
      tLluvia:{r:'E',fam:'f',type:'skill',name:'Lluvia de golpes',desc:'5 golpes rápidos del 100 % que pueden ser críticos (cada 15 s)',cd:15,hits:5},
      tFestin:{r:'E',fam:'s',type:'skill',name:'Festín',desc:'Golpe del 400 %; si mata, +3 % de vida máxima para toda la partida (cada 20 s)',cd:20,mult:4,maxHp:0.03},
      erizo:{r:'E',fam:'e',type:'fx',name:'Erizo',desc:'Cada golpe que recibes hace un 35 % de tu daño a todos los enemigos',pct:0.35},
      ultimo:{r:'E',fam:'s',type:'fx',name:'Último aliento',desc:'La 1.ª vez que bajas del 25 % de vida en cada combate, recuperas el 30 %',below:0.25,heal:0.3}},
    grims:{
      furiaCiega:{r:'C',fam:'f',type:'pas',name:'Furia ciega',desc:'Tu velocidad de ataque extra también sube tu daño crítico (lo mismo en %)'},
      corazaPuas:{r:'C',fam:'e',type:'pas',name:'Coraza de púas',desc:'Púas y Baluarte también devuelven el daño que para tu escudo'},
      sangreHirviente:{r:'C',fam:'s',type:'pas',name:'Sangre hirviente',desc:'Lo que curas con robo de vida estando a tope se convierte en escudo'},
      primerGolpe:{r:'C',fam:'f',type:'fx',name:'Primer golpe',desc:'El primer golpe de cada combate hace +350 %',mult:3.5},
      ancla:{r:'C',fam:'e',type:'fx',name:'Ancla',desc:'Empiezas cada combate con un escudo del 20 % de tu vida',shield:0.2},
      vial:{r:'C',fam:'s',type:'fx',name:'Vial de sangre',desc:'Al empezar cada combate te curas el 5 %',heal:0.05},
      fresa:{r:'C',fam:'s',type:'stat',name:'Fresa',desc:'+10 % de vida máxima',hp:0.10},
      saco:{r:'C',fam:'',type:'stat',name:'Saco de almas',desc:'+50 % de almas',souls:0.5},
      demonio:{r:'R',fam:'f',type:'pas',name:'Forma demoníaca',desc:'+1,8 % de daño por cada segundo de combate',per:0.018},
      juggernaut:{r:'R',fam:'e',type:'pas',name:'Juggernaut',desc:'Cada vez que ganas escudo, golpe del 100 % a un enemigo al azar',mult:1},
      furiaSangre:{r:'R',fam:'s',type:'pas',name:'Furia sangrienta',desc:'+1 % de daño por cada 1 % de vida que te falta',per:1},
      shuriken:{r:'R',fam:'f',type:'fx',name:'Shuriken',desc:'Cada 3 golpes, +3,5 % de daño hasta el final del combate (sin tope)',every:3,atk:0.035},
      arcilla:{r:'R',fam:'e',type:'fx',name:'Arcilla viva',desc:'Al perder vida, ganas un escudo del 50 % de lo que has perdido',pct:0.5},
      mango:{r:'R',fam:'s',type:'stat',name:'Mango',desc:'+15 % de vida máxima',hp:0.15},
      barricada:{r:'E',fam:'e',type:'pas',name:'Barricada',desc:'Tu escudo ya no se gasta con el tiempo y pasa al siguiente combate (hasta el 50 % de tu vida)',cap:0.5},
      segador:{r:'E',fam:'s',type:'pas',name:'Segador',desc:'Tus habilidades y efectos también curan con tu robo de vida (las espinas no), y +8 % de robo de vida',ls:0.08},
      lagarto:{r:'E',fam:'',type:'fx',name:'Cola de lagarto',desc:'Si caes, revives una vez con el 50 % de vida',hp:0.5},
      halcon:{r:'E',fam:'f',type:'stat',name:'Ojo de halcón',desc:'+18 % de crítico y +55 % de daño crítico',cr:0.18,cd:0.55},
      tormenta:{r:'L',fam:'f',type:'pas',name:'Tormenta de acero',desc:'Cada crítico lanza 2 golpes extra (100 %) a otros enemigos',n:2},
      coloso:{r:'L',fam:'e',type:'pas',name:'Coloso',desc:'Cada golpe suma el 25 % de tu escudo actual como daño',pct:0.25},
      corazon:{r:'L',fam:'s',type:'pas',name:'Corazón de sangre',desc:'Cada vez que pierdes vida, +1 % de daño hasta el final del combate (sin tope)',per:0.01},
      eco:{r:'L',fam:'',type:'pas',name:'Eco',desc:'Tus habilidades se lanzan dos veces'},
      explosion:{r:'L',fam:'',type:'fx',name:'Explosión',desc:'Los enemigos que mueren explotan: 120 % de su vida a los cercanos',pct:1.2}}},
  // ---------- servidor, mantenimiento y herramientas de prueba (trozo de la lista CFG) ----------
  // Mantenimiento y actualizaciones obligatorias (control.js): la versión se mira en GitHub cada 'every' s; el mantenimiento, al abrir/volver a la app y, con la clave pública, al instante
  control:{every:300, maintEvery:15},
  supabase:{url:'https://xdtxdaywotkppzssrjni.supabase.co', key:'sb_publishable_60pnk9ALWaV_ks2oAJ7TnA_IFHSG5qH'}, // key: clave pública (publishable/anon) para el aviso en directo
  server:{url:'https://xdtxdaywotkppzssrjni.supabase.co/functions/v1/track', every:10, saveEvery:120}, // saveEvery: subir la partida cada 2 min (lleva los eventos) // base de datos: dirección de la función "track" de Supabase (vacía = no se envía nada); envía como mucho cada 10 s
  devTools:false, // herramientas de prueba (velocidad, +oro, avanzar día…): poner a false al publicar en Telegram
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
const CHEST_PLAN={ own:1,   // parte de las armas que son de tu clase (ahora todas: los cofres solo dan armas de tu clase)
   copies:11, eta:0.9, rho:0.5, beta:11, itemSCE:12,
  // [modo, desde fase, rareza T, días, plata/día, madera/día, suerte de la rareza siguiente]
  // (Normal medido con plata comprada con oro, 10/día, y madera solo de jefes y eventos; Pesadilla e Infierno: recalibrar al desbloquearlos)
  seg:[[0,1,'C',3.3,10,3.2,0.05],[0,100,'U',8,10,1.5,0],[1,1,'R',16,8.3,3.0,0],[2,1,'E',20,9,3,0]],
  // cofre de modo por modo: rareza T (de la plata de ese modo), fijas, principal y premio gordo
  // (todas las armas son de tu clase: el cofre de modo da sobre todo la rareza del modo y a veces la siguiente)
  mode:[{T:'U',fixed:{},main:'U',jackpot:'R'},
        {T:'R',fixed:{},main:'R',jackpot:'E'},
        {T:'E',fixed:{M:0.005},main:'E',jackpot:'L'}],   // (la Mítica solo sale aquí)
};
// cofre de madera: reparto fijo (siempre Común y Poco común; Rara desde Pesadilla), no sale de la curva
const WOOD_FIX=[{1:{C:95,U:5},100:{C:90,U:10}},{1:{C:60,U:38,R:2}},{1:{C:50,U:45,R:5}}];   // por modo y fase desde la que vale
(function buildChests(P,C){
  const R=C.rar, idx=r=>R.indexOf(r), r2=x=>Math.round(x*1000)/10;       // % con un decimal
  const vec=o=>R.map(r=>r2(o[r]||0)), fix=v=>{ const d=Math.round((100-v.reduce((a,b)=>a+b,0))*10)/10, k=v.indexOf(Math.max(...v)); v[k]=Math.round((v[k]+d)*10)/10; return v }; // suma exacta 100
  const wood=[[],[],[]], silver=[[],[],[]], mode=[], sceS=[];
  for(const [m,from,T,days,S,W,luck] of P.seg){
    const den=P.own*days*(S+P.rho*W), t=idx(T), pT=Math.min(1,P.copies/(P.eta*den)), pN=t<R.length-1?-Math.log(1-luck)/den:0;
    const mk=k=>{ const o={}; o[R[t+1]]=pN*k; o[T]=Math.min(1-pN*k,pT*k); if(t>0) o[R[t-1]]=(o[R[t-1]]||0)+1-o[T]-pN*k; else o[T]=1-pN*k; return fix(vec(o)) };
    silver[m].push([from,mk(1)]); const wf=WOOD_FIX[m]&&WOOD_FIX[m][from]; wood[m].push([from,wf?R.map(r=>wf[r]||0):mk(P.rho)]);
    const sv=silver[m].slice(-1)[0][1]; sceS[m]=R.reduce((a,r,i)=>a+sv[i]/100*Math.pow(P.beta,i-t),0);   // valor de 1 plata en copias de T (último tramo del modo)
  }
  P.mode.forEach((M,m)=>{ const t=idx(M.T), val=r=>Math.pow(P.beta,idx(r)-t), V=P.itemSCE*sceS[m];
    let fs=0, fv=0; for(const r in M.fixed){ fs+=M.fixed[r]; fv+=M.fixed[r]*val(r); }
    const pJ=Math.max(0,(V-fv-(1-fs)*val(M.main))/(val(M.jackpot)-val(M.main))), o={...M.fixed}; o[M.jackpot]=(o[M.jackpot]||0)+pJ; o[M.main]=(o[M.main]||0)+1-fs-pJ;
    mode.push([[1,fix(vec(o))]]); });
  // plata: reparto fijo elegido a mano (siempre mejor que la madera); el cofre de modo se queda como estaba
  const fx=o=>C.rar.map(r=>o[r]||0);
  silver[0]=[[1,fx({C:80,U:20})],[100,fx({C:70,U:28,R:2})]]; silver[1]=[[1,fx({C:30,U:55,R:15})]]; silver[2]=[[1,fx({U:50,R:42,E:8})]];
  mode[0]=[[1,fx({U:83.6,R:16.4})]]; mode[1]=[[1,fx({R:89.8,E:10.2})]]; mode[2]=[[1,fx({E:97.2,L:2.3,M:0.5})]];
  C.chests.wood.odds=wood; C.chests.silver.odds=silver; C.chests.mode.odds=mode;
  C.chestPlan=P;
})(CHEST_PLAN,CFG);
root.CFG=CFG;
if(typeof module!=='undefined'&&module.exports) module.exports=CFG;
})(typeof window!=='undefined'?window:globalThis);
