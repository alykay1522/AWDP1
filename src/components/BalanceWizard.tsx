import { useState } from "react";

type WizardData = {
  windowType: string;
  balanceType: string;
  length: string;
  stamp: string;
  width: string;
  tilt: boolean | null;
};

type Product = {
  type: string;
  length: string;
  width: string;
  stamp: string;
  name: string;
  sku: string;
};

const initialState: WizardData = {
  windowType: "",
  balanceType: "",
  length: "",
  stamp: "",
  width: "",
  tilt: null,
};

export default function BalanceWizard() {
  const [step, setStep] = useState<number>(1);
  const [data, setData] = useState<WizardData>(initialState);
  const [results, setResults] = useState<Product[]>([]);

  const update = (values: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...values }));
  };

  const next = (values: Partial<WizardData> = {}) => {
    update(values);
    setStep((s) => s + 1);
  };

  const back = () => setStep((s) => s - 1);

  const reset = () => {
    setData(initialState);
    setStep(1);
    setResults([]);
  };

  // 🔴 Replace with real data later
  const mockProducts: Product[] = [
    {
      type: "channel",
      length: "28",
      width: "1/2",
      stamp: "2830",
      name: "28” Channel Balance 2830",
      sku: "CH-28-2830",
    },
  ];

  function matchProducts() {
    const matches = mockProducts.filter((p) => {
      return (
        p.type === data.balanceType &&
        (!data.length || p.length === data.length) &&
        (!data.width || p.width === data.width) &&
        (!data.stamp || p.stamp === data.stamp)
      );
    });

    setResults(matches);
    setStep(99);
  }

  return (
    <div style={{ maxWidth: 600, margin: "40px auto" }}>
      <h2>Find Your Window Balance</h2>

      {step === 1 && (
        <>
          <p>What type of window?</p>
          <button onClick={() => next({ windowType: "tilt" })}>Tilt-In</button>
          <button onClick={() => next({ windowType: "non-tilt" })}>Non-Tilt</button>
        </>
      )}

      {step === 2 && (
        <>
          <p>What does your balance look like?</p>
          <button onClick={() => next({ balanceType: "channel" })}>
            Metal Channel
          </button>
          <button onClick={() => next({ balanceType: "spiral" })}>
            Spiral Rod
          </button>
          <button onClick={() => next({ balanceType: "coil" })}>
            Coil Spring
          </button>
          <br /><br />
          <button onClick={back}>Back</button>
        </>
      )}

      {step === 3 && data.balanceType === "channel" && (
        <>
          <p>Channel length (inches)</p>
          <input
            type="number"
            value={data.length}
            onChange={(e) => update({ length: e.target.value })}
          />
          <button onClick={() => next()}>Next</button>
          <button onClick={back}>Back</button>
        </>
      )}

      {step === 4 && data.balanceType === "channel" && (
        <>
          <p>Stamp code</p>
          <input
            type="text"
            value={data.stamp}
            onChange={(e) => update({ stamp: e.target.value })}
          />
          <button onClick={() => next()}>Next</button>
          <button onClick={back}>Back</button>
        </>
      )}

      {step === 5 && data.balanceType === "channel" && (
        <>
          <p>Select width</p>
          <button onClick={() => next({ width: "1/2" })}>1/2"</button>
          <button onClick={() => next({ width: "5/8" })}>5/8"</button>
          <button onClick={() => next({ width: "3/8" })}>3/8"</button>
          <br /><br />
          <button onClick={back}>Back</button>
        </>
      )}

      {step === 6 && data.balanceType === "channel" && (
        <>
          <p>Does window tilt?</p>
          <button onClick={() => next({ tilt: true })}>Yes</button>
          <button onClick={() => next({ tilt: false })}>No</button>
          <br /><br />
          <button onClick={back}>Back</button>
        </>
      )}

      {step === 7 && data.balanceType === "channel" && (
        <>
          <p>Find matches</p>
          <button onClick={matchProducts}>Search</button>
          <button onClick={back}>Back</button>
        </>
      )}

      {step === 99 && (
        <>
          <h3>Results</h3>

          {results.length === 0 ? (
            <p>No matches found</p>
          ) : (
            results.map((r) => (
              <div key={r.sku}>
                <strong>{r.name}</strong>
                <div>{r.sku}</div>
              </div>
            ))
          )}

          <button onClick={reset}>Start Over</button>
        </>
      )}
    </div>
  );
}
