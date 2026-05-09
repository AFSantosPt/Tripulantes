import { Redirect, useLocalSearchParams } from "expo-router";

export default function ShiftImportRedirect() {
  const params = useLocalSearchParams<{ date?: string }>();
  return (
    <Redirect
      href={{
        pathname: "/shift-new",
        params: { date: params.date },
      }}
    />
  );
}
