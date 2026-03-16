"use client"
import { useState, useCallback } from "react"
import type { GameComponentProps, GamePhase } from "@/types/game"

type Suit = "S"|"H"|"D"|"C"
type Color = "black"|"red"
interface Card{suit:Suit;value:number;faceUp:boolean;id:string}

const SUITS:Suit[]=["S","H","D","C"]
const VALUES=Array.from({length:13},(_,i)=>i+1)
const SUITS_DISPLAY:Record<Suit,string>={"S":"♠","H":"♥","D":"♦","C":"♣"}
const SUIT_COLOR:Record<Suit,Color>={"S":"black","H":"red","D":"red","C":"black"}
const VAL_LABEL=["A","2","3","4","5","6","7","8","9","10","J","Q","K"]

function makeDeck():Card[]{
  const deck:Card[]=[]
  SUITS.forEach(s=>VALUES.forEach(v=>deck.push({suit:s,value:v,faceUp:false,id:`${s}${v}`})))
  return deck.sort(()=>Math.random()-0.5)
}

function initGame(){
  const deck=makeDeck()
  const tableau:Card[][]=Array.from({length:7},()=>[])
  for(let i=0;i<7;i++) for(let j=i;j<7;j++){const c=deck.pop()!;c.faceUp=j===i;tableau[j].push(c)}
  const stock=[...deck].reverse()
  return{tableau,foundations:[[] as Card[],[],[],[]],stock,waste:[] as Card[]}
}

export default function SolitaireGame({onScoreUpdate,onGameOver,onGameStart,isPaused}:GameComponentProps){
  const [state,setState]=useState(initGame)
  const [phase,setPhase]=useState<GamePhase>("start")
  const [selected,setSelected]=useState<{from:"tableau"|"waste"|"foundation";idx:number;cardIdx?:number}|null>(null)
  const [score,setScore]=useState(0)
  const scoreRef={current:0}

  function canPlaceOnTableau(card:Card,target:Card[]):boolean{
    if(!target.length) return card.value===13
    const top=target[target.length-1]
    return top.faceUp&&top.value===card.value+1&&SUIT_COLOR[top.suit]!==SUIT_COLOR[card.suit]
  }
  function canPlaceOnFoundation(card:Card,foundation:Card[]):boolean{
    if(!foundation.length) return card.value===1
    const top=foundation[foundation.length-1]
    return top.suit===card.suit&&card.value===top.value+1
  }

  const drawFromStock=useCallback(()=>{
    setState(s=>{
      if(!s.stock.length){if(!s.waste.length) return s;return{...s,stock:[...s.waste].reverse().map(c=>({...c,faceUp:false})),waste:[]}}
      const card={...s.stock[s.stock.length-1],faceUp:true}
      return{...s,stock:s.stock.slice(0,-1),waste:[...s.waste,card]}
    })
    setSelected(null)
  },[])

  const handleSelect=useCallback((from:"tableau"|"waste"|"foundation",idx:number,cardIdx?:number)=>{
    if(selected){
      // Try to move
      setState(prev=>{
        const s={...prev,tableau:prev.tableau.map(t=>[...t]),foundations:prev.foundations.map(f=>[...f]),waste:[...prev.waste]}
        let cards:Card[]
        if(selected.from==="waste"){cards=[s.waste[s.waste.length-1]];if(!cards[0]) return prev}
        else if(selected.from==="foundation"){cards=[s.foundations[selected.idx][s.foundations[selected.idx].length-1]];if(!cards[0]) return prev}
        else{cards=s.tableau[selected.idx].slice(selected.cardIdx);if(!cards.length||!cards[0].faceUp) return prev}
        if(from==="tableau"){
          if(cards.length===1&&canPlaceOnFoundation(cards[0],s.foundations[idx])&&cardIdx===undefined){
            // Actually place on foundation
            if(selected.from==="waste") s.waste.pop()
            else if(selected.from==="tableau"){s.tableau[selected.idx].splice(selected.cardIdx!);const last=s.tableau[selected.idx][s.tableau[selected.idx].length-1];if(last) last.faceUp=true}
            else s.foundations[selected.idx].pop()
            s.foundations[idx].push(cards[0])
            scoreRef.current+=15;setScore(scoreRef.current)
            setSelected(null)
            return s
          }
          if(canPlaceOnTableau(cards[0],s.tableau[idx])){
            if(selected.from==="waste") s.waste.pop()
            else if(selected.from==="tableau"){s.tableau[selected.idx].splice(selected.cardIdx!);const last=s.tableau[selected.idx][s.tableau[selected.idx].length-1];if(last) last.faceUp=true}
            else s.foundations[selected.idx].pop()
            s.tableau[idx].push(...cards)
            scoreRef.current+=5;setScore(scoreRef.current)
            setSelected(null)
            return s
          }
        } else if(from==="foundation"&&cards.length===1&&canPlaceOnFoundation(cards[0],s.foundations[idx])){
          if(selected.from==="waste") s.waste.pop()
          else if(selected.from==="tableau"){s.tableau[selected.idx].splice(selected.cardIdx!);const last=s.tableau[selected.idx][s.tableau[selected.idx].length-1];if(last) last.faceUp=true}
          else s.foundations[selected.idx].pop()
          s.foundations[idx].push(cards[0])
          scoreRef.current+=15;setScore(scoreRef.current)
          setSelected(null)
          return s
        }
        setSelected(null)
        return prev
      })
    } else {
      setSelected({from,idx,cardIdx})
    }
  },[selected])

  const isSelected=(from:"tableau"|"waste"|"foundation",idx:number,cardIdx?:number)=>{
    return selected?.from===from&&selected?.idx===idx&&(cardIdx===undefined||selected?.cardIdx===cardIdx)
  }

  const startGame=useCallback(()=>{setState(initGame());setScore(0);scoreRef.current=0;setPhase("playing");setSelected(null);onGameStart()},[onGameStart])

  // Win check
  const hasWon=state.foundations.every(f=>f.length===13)

  function cardLabel(card:Card){return`${VAL_LABEL[card.value-1]}${SUITS_DISPLAY[card.suit]}`}
  function cardColor(card:Card){return SUIT_COLOR[card.suit]==="red"?"text-neon-red":"text-white"}

  const CardEl=({card,onClick,sel}:{card:Card;onClick:()=>void;sel:boolean})=>(
    <div onClick={onClick} className={"w-12 h-16 rounded border text-xs font-bold flex flex-col items-start p-1 cursor-pointer select-none transition-all "+(card.faceUp?"bg-white hover:brightness-110":"bg-space-surface border-space-border")+(sel?" ring-2 ring-neon-yellow scale-105":"")}>
      {card.faceUp&&<><span className={cardColor(card)}>{VAL_LABEL[card.value-1]}{card.suit}</span></>}
    </div>
  )

  return(
    <div className="flex flex-col items-center gap-4 w-full max-w-2xl overflow-x-auto">
      {phase==="start"&&<div className="text-center py-8">
        <div className="text-5xl mb-4">🃏</div>
        <h2 className="text-2xl font-orbitron text-neon-purple mb-2">KLONDIKE SOLITAIRE</h2>
        <p className="text-space-muted mb-6 text-sm">Classic card game. Build foundations A→K by suit!</p>
        <button onClick={startGame} className="btn-primary px-8 py-3">DEAL CARDS</button>
      </div>}
      {(phase==="playing"||hasWon)&&<>
        <div className="flex gap-4 items-start w-full justify-between px-2">
          {/* Stock + Waste */}
          <div className="flex gap-2">
            <div onClick={drawFromStock} className="w-12 h-16 rounded border border-space-border bg-space-surface cursor-pointer flex items-center justify-center text-space-muted hover:border-neon-purple/50 text-xs">
              {state.stock.length?`↺${state.stock.length}`:"↺"}
            </div>
            <div onClick={()=>state.waste.length&&handleSelect("waste",0)} className={"w-12 h-16 rounded border "+(isSelected("waste",0)?"ring-2 ring-neon-yellow border-neon-yellow":"border-space-border")+" bg-white flex items-center justify-center"}>
              {state.waste.length?<span className={cardColor(state.waste[state.waste.length-1])+" text-xs font-bold"}>{cardLabel(state.waste[state.waste.length-1])}</span>:<span className="text-gray-400 text-xs">waste</span>}
            </div>
          </div>
          {/* Foundations */}
          <div className="flex gap-2">
            {state.foundations.map((f,i)=>(
              <div key={i} onClick={()=>handleSelect("foundation",i)}
                className={"w-12 h-16 rounded border flex items-center justify-center text-xs font-bold cursor-pointer "+(isSelected("foundation",i)?"ring-2 ring-neon-yellow border-neon-yellow":f.length?"border-neon-green/40 bg-neon-green/5":"border-space-border bg-space-surface")}>
                {f.length?<span className={cardColor(f[f.length-1])}>{cardLabel(f[f.length-1])}</span>:<span className="text-space-muted">{SUITS_DISPLAY[SUITS[i] as Suit]}</span>}
              </div>
            ))}
          </div>
        </div>
        {/* Score */}
        <div className="text-sm font-rajdhani text-space-muted">Score: <span className="text-neon-purple font-bold">{score}</span></div>
        {/* Tableau */}
        <div className="flex gap-2 w-full justify-center">
          {state.tableau.map((pile,pi)=>(
            <div key={pi} className="relative flex flex-col" style={{minHeight:80,width:52}}>
              {!pile.length&&<div onClick={()=>handleSelect("tableau",pi)} className="w-12 h-16 rounded border border-space-border border-dashed opacity-40 cursor-pointer" />}
              {pile.map((card,ci)=>(
                <div key={card.id} style={{marginTop:ci===0?0:-48,position:"relative",zIndex:ci}}>
                  <CardEl card={card} onClick={()=>card.faceUp&&handleSelect("tableau",pi,ci)} sel={isSelected("tableau",pi,ci)||(selected?.from==="tableau"&&selected.idx===pi&&selected.cardIdx!==undefined&&ci>=selected.cardIdx)} />
                </div>
              ))}
            </div>
          ))}
        </div>
        {hasWon&&<div className="fixed inset-0 bg-space-bg/90 flex flex-col items-center justify-center z-50">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-orbitron text-neon-yellow mb-2">YOU WIN!</h2>
          <p className="text-2xl text-neon-purple mb-6">{score} pts</p>
          <button onClick={startGame} className="btn-primary px-8 py-3">DEAL AGAIN</button>
        </div>}
      </>}
    </div>
  )
}