import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

export function FollowupsPage() {
  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>Seguimientos</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Página de seguimientos — aquí aparecerán los seguimientos y recordatorios.</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default FollowupsPage;
