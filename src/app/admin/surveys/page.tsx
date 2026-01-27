"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Seminar, PreSurveyResponse, PostSurveyResponse } from "@/lib/types";

export default function AdminSurveysPage() {
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [selectedSeminar, setSelectedSeminar] = useState<string>("");
  const [preSurveys, setPreSurveys] = useState<PreSurveyResponse[]>([]);
  const [postSurveys, setPostSurveys] = useState<PostSurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSurveys, setLoadingSurveys] = useState(false);

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
      setPreSurveys([]);
      setPostSurveys([]);
      return;
    }

    const seminar = seminars.find((s) => s.id === selectedSeminar);
    if (!seminar?.spreadsheet_id) return;

    setLoadingSurveys(true);
    Promise.all([
      fetch(`/api/surveys/results?spreadsheet_id=${seminar.spreadsheet_id}&type=pre`).then((r) =>
        r.json()
      ),
      fetch(`/api/surveys/results?spreadsheet_id=${seminar.spreadsheet_id}&type=post`).then((r) =>
        r.json()
      ),
    ])
      .then(([pre, post]) => {
        if (Array.isArray(pre)) setPreSurveys(pre);
        if (Array.isArray(post)) setPostSurveys(post);
      })
      .finally(() => setLoadingSurveys(false));
  }, [selectedSeminar, seminars]);

  if (loading) {
    return <p className="text-muted-foreground">読み込み中...</p>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">アンケート結果</h1>

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
          セミナーを選択するとアンケート結果が表示されます。
        </p>
      )}

      {loadingSurveys && <p className="text-muted-foreground">読み込み中...</p>}

      {selectedSeminar && !loadingSurveys && (
        <Tabs defaultValue="pre">
          <TabsList>
            <TabsTrigger value="pre">事前アンケート ({preSurveys.length}件)</TabsTrigger>
            <TabsTrigger value="post">事後アンケート ({postSurveys.length}件)</TabsTrigger>
          </TabsList>

          <TabsContent value="pre">
            {preSurveys.length === 0 ? (
              <p className="mt-4 text-muted-foreground">回答がありません。</p>
            ) : (
              <>
                <Card className="mb-4 mt-4">
                  <CardHeader>
                    <CardTitle className="text-sm">関心度 平均</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {(
                        preSurveys.reduce(
                          (sum, s) => sum + (parseInt(s.q1_interest_level) || 0),
                          0
                        ) / preSurveys.length
                      ).toFixed(1)}
                      /5
                    </p>
                  </CardContent>
                </Card>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>関心度</TableHead>
                      <TableHead>期待すること</TableHead>
                      <TableHead>経験</TableHead>
                      <TableHead>事前質問</TableHead>
                      <TableHead>回答日時</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preSurveys.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.q1_interest_level}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {s.q2_expectations}
                        </TableCell>
                        <TableCell>{s.q3_experience}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {s.q4_questions}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {s.submitted_at
                            ? new Date(s.submitted_at).toLocaleDateString("ja-JP")
                            : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </TabsContent>

          <TabsContent value="post">
            {postSurveys.length === 0 ? (
              <p className="mt-4 text-muted-foreground">回答がありません。</p>
            ) : (
              <>
                <div className="mb-4 mt-4 grid gap-4 sm:grid-cols-3">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">満足度 平均</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {(
                          postSurveys.reduce(
                            (sum, s) => sum + (parseInt(s.q1_satisfaction) || 0),
                            0
                          ) / postSurveys.length
                        ).toFixed(1)}
                        /5
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">内容の質 平均</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {(
                          postSurveys.reduce(
                            (sum, s) => sum + (parseInt(s.q2_content_quality) || 0),
                            0
                          ) / postSurveys.length
                        ).toFixed(1)}
                        /5
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">NPS 平均</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {(
                          postSurveys.reduce(
                            (sum, s) => sum + (parseInt(s.q6_recommend) || 0),
                            0
                          ) / postSurveys.length
                        ).toFixed(1)}
                        /10
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>満足度</TableHead>
                      <TableHead>内容</TableHead>
                      <TableHead>登壇者</TableHead>
                      <TableHead>学んだこと</TableHead>
                      <TableHead>改善点</TableHead>
                      <TableHead>NPS</TableHead>
                      <TableHead>回答日時</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {postSurveys.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.q1_satisfaction}</TableCell>
                        <TableCell>{s.q2_content_quality}</TableCell>
                        <TableCell>{s.q3_speaker_rating}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {s.q4_learnings}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {s.q5_improvements}
                        </TableCell>
                        <TableCell>{s.q6_recommend}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {s.submitted_at
                            ? new Date(s.submitted_at).toLocaleDateString("ja-JP")
                            : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
