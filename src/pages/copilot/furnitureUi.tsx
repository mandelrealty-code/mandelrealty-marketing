import { useState } from "react";
import type { FurnitureCard, FurnitureSlot, FurnitureView } from "../../../shared/copilot/types";

const cad = (value: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(value);

function Card({ card, chosen }: { card: FurnitureCard; chosen: boolean }) {
  const [broken, setBroken] = useState(false);
  return (
    <article className={`cp-fcard${chosen ? " chosen" : ""}`}>
      <a className="cp-fimg" href={card.url} target="_blank" rel="noopener noreferrer" aria-label={`${card.name}, open the listing`}>
        {card.image && !broken ? <img src={card.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} /> : <span>{card.store}</span>}
        <i className="cp-fn">{card.n}</i>
      </a>
      <div className="cp-fbody">
        <h5>{card.name}</h5>
        <p className="cp-fprice">{cad(card.priceCad)}{chosen ? <b>Chosen</b> : null}</p>
        <p className="cp-fstore">{card.store}</p>
        <p className="cp-fwhy">{card.why}</p>
        <a className="cp-flink" href={card.url} target="_blank" rel="noopener noreferrer">View listing</a>
      </div>
    </article>
  );
}

function Slot({ slot }: { slot: FurnitureSlot }) {
  return (
    <section className="cp-fslot">
      <h4>{slot.room}<span> · {slot.piece}</span></h4>
      <div className="cp-fgrid">
        {slot.cards.map((card) => <Card key={card.url} card={card} chosen={slot.chosen === card.url} />)}
      </div>
    </section>
  );
}

/** The slots this message shows, as product cards. The rest of the working set is not redrawn. */
export function FurnitureCards({ view }: { view: FurnitureView }) {
  const slots = view.slots.filter((slot) => view.shown.includes(slot.id));
  return <div className="cp-fcards">{slots.map((slot) => <Slot key={slot.id} slot={slot} />)}</div>;
}
