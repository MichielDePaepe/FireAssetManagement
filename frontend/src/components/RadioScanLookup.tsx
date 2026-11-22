import { useState } from "react";
import { PagerScanControl } from "@/components/PagerScanControl";
import { api, type RadioAsset } from "@/lib/api";

interface RadioScanLookupProps {
  onRadioIdentified?: (radio: RadioAsset) => void;
}

export function RadioScanLookup({ onRadioIdentified }: RadioScanLookupProps) {
  const [radio, setRadio] = useState<RadioAsset | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function lookup(scannedLine: string) {
    setRadio(null);
    setError(null);
    try {
      const result = await api.lookupRadioScan(scannedLine);
      setRadio(result.radio);
      onRadioIdentified?.(result.radio);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Radio zoeken is niet gelukt.");
    }
  }

  return (
    <section aria-label="Radio identificeren" className="flex flex-wrap items-start gap-3">
      <PagerScanControl onScan={lookup} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {radio && (
        <div role="status" className="min-w-48 border px-3 py-2 text-sm">
          <p className="font-medium">Radio gevonden</p>
          <p className="font-mono">{radio.tei}</p>
          <p className="text-muted-foreground">
            {radio.model ? `${radio.model.manufacturer} ${radio.model.name}` : "Model onbekend"}
          </p>
        </div>
      )}
    </section>
  );
}
