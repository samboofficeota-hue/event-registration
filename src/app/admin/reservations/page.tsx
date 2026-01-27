"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Seminar, Reservation } from "@/lib/types";

export default function AdminReservationsPage() {
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [selectedSeminar, setSelectedSeminar] = useState<string>("");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRes, setLoadingRes] = useState(false);

  useEffect(() => {
    fetch("/api/seminars")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setSeminars(data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedSeminar) {
      setReservations([]);
      return;
    }

    const seminar = seminars.find((s) => s.id === selectedSeminar);
    if (!seminar?.spreadsheet_id) return;

    setLoadingRes(true);
    fetch(`/api/reservations?spreadsheet_id=${seminar.spreadsheet_id}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setReservations(data);
      })
      .finally(() => setLoadingRes(false));
  }, [selectedSeminar, seminars]);

  if (loading) {
    return <p className="text-muted-foreground">読み込み中...</p>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">予約一覧</h1>

      <div className="mb-4 max-w-sm">
        <Select value={selectedSeminar} onValueChange={setSelectedSeminar}>
          <SelectTrigger>
            <SelectValue placeholder="セミナーを選択" />
          </SelectTrigger>
          <SelectContent>
            {seminars.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedSeminar && (
        <p className="text-muted-foreground">
          セミナーを選択すると予約一覧が表示されます。
        </p>
      )}

      {loadingRes && <p className="text-muted-foreground">読み込み中...</p>}

      {selectedSeminar && !loadingRes && (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {reservations.length}件の予約
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>氏名</TableHead>
                <TableHead>メール</TableHead>
                <TableHead>会社名</TableHead>
                <TableHead>部署</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>事前アンケート</TableHead>
                <TableHead>事後アンケート</TableHead>
                <TableHead>予約日時</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservations.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.email}</TableCell>
                  <TableCell>{r.company}</TableCell>
                  <TableCell>{r.department}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.status === "confirmed" ? "default" : "destructive"
                      }
                    >
                      {r.status === "confirmed" ? "確定" : "キャンセル"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {r.pre_survey_completed ? (
                      <Badge variant="default">回答済</Badge>
                    ) : (
                      <Badge variant="outline">未回答</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.post_survey_completed ? (
                      <Badge variant="default">回答済</Badge>
                    ) : (
                      <Badge variant="outline">未回答</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.created_at
                      ? new Date(r.created_at).toLocaleDateString("ja-JP")
                      : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}
