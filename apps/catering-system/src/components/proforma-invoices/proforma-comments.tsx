"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface CommentRow {
  id: string;
  author_type: "portal" | "staff";
  body: string;
  created_at: string;
}

/** Two-way comment thread with the admin portal — see supabase/migrations/20260901090000_proforma_comments.sql. */
export function ProformaComments({ proformaId }: { proformaId: string }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: comments, isLoading } = useQuery({
    queryKey: ["proforma-comments", proformaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proforma_comments")
        .select("id, author_type, body, created_at")
        .eq("proforma_id", proformaId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as CommentRow[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`proforma-${proformaId}-comments-staff`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "proforma_comments", filter: `proforma_id=eq.${proformaId}` },
        () => queryClient.invalidateQueries({ queryKey: ["proforma-comments", proformaId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, proformaId]);

  const submit = async () => {
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("proforma_comments").insert({
        proforma_id: proformaId,
        author_type: "staff",
        staff_author_id: user?.id ?? null,
        body: body.trim(),
      });
      if (error) throw error;
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["proforma-comments", proformaId] });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Comments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : comments && comments.length > 0 ? (
          <ul className="space-y-2">
            {comments.map((c) => (
              <li key={c.id} className="text-sm rounded-md bg-muted/40 p-2">
                <span className="text-xs text-muted-foreground">
                  {c.author_type === "portal" ? "Admin" : "Staff"} · {new Date(c.created_at).toLocaleString()}
                </span>
                <p>{c.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        )}
        <div className="flex gap-2">
          <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Reply…" />
          <Button onClick={submit} disabled={submitting || !body.trim()}>
            {submitting ? "Posting…" : "Post"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
