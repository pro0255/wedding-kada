import MericPlynulosti from "./MericPlynulosti";

/* Všechny návrhy mají v rohu měřič plynulosti — viz MericPlynulosti. */
export default function NavrhLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <MericPlynulosti />
    </>
  );
}
