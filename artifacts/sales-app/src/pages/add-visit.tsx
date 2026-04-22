import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, CheckCircle2, Camera, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const AREA_OPTIONS = [
  "North Zone", "South Zone", "East Zone", "West Zone",
  "Central", "Suburban", "Industrial", "Other",
];

const SITE_STAGE_OPTIONS = [
  "Foundation", "Plinth", "Roof Slab",
  "Brick Work", "Plastering", "Finishing", "Handover", "Other",
];

const visitSchema = z
  .object({
    customer_name:    z.string().trim().min(1, "Customer name is required"),
    mobile_number:    z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
    company_name:     z.string().trim().min(1, "Company name is required"),
    area:             z.string().min(1, "Area is required"),
    area_other:       z.string().trim().optional(),
    layout:           z.string().trim().min(1, "Layout / project name is required"),
    location_link:    z.string().trim().min(1, "Location link is required"),
    site_stage:       z.string().min(1, "Site stage is required"),
    site_stage_other: z.string().trim().optional(),
    feedback:         z.enum(["Interested", "Not Interested", "Potential"], {
      errorMap: () => ({ message: "Please select a feedback option" }),
    }),
    notes:            z.string().trim().min(1, "Notes are required"),
    image_url:        z.string().min(1, "Photo is required — please upload a site image"),
  })
  .superRefine((data, ctx) => {
    if (data.area === "Other" && !data.area_other?.trim()) {
      ctx.addIssue({ code: "custom", path: ["area_other"], message: "Please specify the area" });
    }
    if (data.site_stage === "Other" && !data.site_stage_other?.trim()) {
      ctx.addIssue({ code: "custom", path: ["site_stage_other"], message: "Please specify the site stage" });
    }
  });

type VisitFormValues = z.infer<typeof visitSchema>;

export default function AddVisit() {
  const { toast } = useToast();
  const [success, setSuccess] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedBrandIds, setSelectedBrandIds] = useState<number[]>([]);
  const [customBrands, setCustomBrands] = useState<string[]>([]);
  const [customBrandInput, setCustomBrandInput] = useState("");
  const [brandsError, setBrandsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: brandsResp } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/brands", { headers: { Authorization: `Bearer ${token}` } });
      return res.json();
    },
  });
  const availableBrands: { id: number; name: string }[] = (brandsResp as any)?.data ?? [];

  const form = useForm<VisitFormValues>({
    resolver: zodResolver(visitSchema),
    defaultValues: {
      customer_name: "",
      mobile_number: "",
      company_name: "",
      area: "",
      area_other: "",
      layout: "",
      location_link: "",
      site_stage: "",
      site_stage_other: "",
      feedback: undefined,
      notes: "",
      image_url: "",
    },
  });

  const watchArea = form.watch("area");
  const watchSiteStage = form.watch("site_stage");

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "Invalid file", description: "Please select an image file." });
      return;
    }

    setImagePreview(URL.createObjectURL(file));
    setUploadingImage(true);
    form.setValue("image_url", "");

    try {
      const token = localStorage.getItem("auth_token");
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Upload failed");
      }
      const { url } = await res.json();
      form.setValue("image_url", url, { shouldValidate: true });
    } catch (err: any) {
      setImagePreview(null);
      toast({ variant: "destructive", title: "Upload failed", description: err.message || "Please try again." });
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    form.setValue("image_url", "", { shouldValidate: true });
  };

  const toggleBrand = (id: number) => {
    setSelectedBrandIds((prev) => prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]);
    setBrandsError(null);
  };

  const addCustomBrand = () => {
    const name = customBrandInput.trim();
    if (!name) return;
    if (customBrands.includes(name)) return;
    setCustomBrands((prev) => [...prev, name]);
    setCustomBrandInput("");
    setBrandsError(null);
  };

  const totalBrandsSelected = selectedBrandIds.length + customBrands.length;

  const onSubmit = async (data: VisitFormValues) => {
    if (totalBrandsSelected === 0) {
      setBrandsError("At least one brand must be selected");
      return;
    }

    const body = {
      customer_name:  data.customer_name,
      mobile_number:  data.mobile_number,
      company_name:   data.company_name,
      area:           data.area === "Other" ? data.area_other! : data.area,
      layout:         data.layout,
      location_link:  data.location_link,
      site_stage:     data.site_stage === "Other" ? data.site_stage_other! : data.site_stage,
      brands_used:    [
        ...selectedBrandIds.map((id) => ({ brandId: id })),
        ...customBrands.map((name) => ({ customBrandName: name })),
      ],
      feedback:       data.feedback,
      notes:          data.notes,
      image_url:      data.image_url,
    };

    setSubmitting(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Server error ${res.status}`);
      }

      setSuccess(true);
      form.reset();
      setSelectedBrandIds([]);
      setCustomBrands([]);
      setCustomBrandInput("");
      setImagePreview(null);
      setTimeout(() => setSuccess(false), 4000);
      toast({ title: "Visit recorded", description: "Saved to the database." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "Failed to record visit." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-lg mx-auto pb-32">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-primary/10 rounded-xl text-primary">
          <MapPin className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Record Visit</h1>
          <p className="text-sm text-muted-foreground">All fields are required</p>
        </div>
      </div>

      {success && (
        <div className="bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400 p-4 rounded-lg flex items-center gap-3 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="font-medium text-sm">Visit recorded successfully!</span>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

          {/* Customer Info */}
          <Card className="border-none shadow-md bg-card/50">
            <CardContent className="p-5 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer Info</p>

              <FormField control={form.control} name="customer_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Name *</FormLabel>
                  <FormControl><Input placeholder="Owner or shop name" {...field} className="h-11" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="mobile_number" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mobile Number *</FormLabel>
                  <FormControl><Input placeholder="9876543210" type="tel" maxLength={10} {...field} className="h-11" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="company_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Company / Builder Name *</FormLabel>
                  <FormControl><Input placeholder="e.g. Prestige Constructions" {...field} className="h-11" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Site Details */}
          <Card className="border-none shadow-md bg-card/50">
            <CardContent className="p-5 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Site Details</p>

              <FormField control={form.control} name="area" render={({ field }) => (
                <FormItem>
                  <FormLabel>Area *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Select area" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {AREA_OPTIONS.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {watchArea === "Other" && (
                <FormField control={form.control} name="area_other" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specify Area *</FormLabel>
                    <FormControl><Input placeholder="Enter area name" {...field} className="h-11" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              <FormField control={form.control} name="layout" render={({ field }) => (
                <FormItem>
                  <FormLabel>Layout / Project Name *</FormLabel>
                  <FormControl><Input placeholder="e.g. Green Valley Phase 2" {...field} className="h-11" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="location_link" render={({ field }) => (
                <FormItem>
                  <FormLabel>Location Link *</FormLabel>
                  <FormControl><Input placeholder="Google Maps URL or any location link" {...field} className="h-11" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="site_stage" render={({ field }) => (
                <FormItem>
                  <FormLabel>Site Stage *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Select current stage" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SITE_STAGE_OPTIONS.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {watchSiteStage === "Other" && (
                <FormField control={form.control} name="site_stage_other" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specify Stage *</FormLabel>
                    <FormControl><Input placeholder="Enter stage name" {...field} className="h-11" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </CardContent>
          </Card>

          {/* Brands */}
          <Card className="border-none shadow-md bg-card/50">
            <CardContent className="p-5 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Brands Used *</p>

              {availableBrands.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {availableBrands.map((brand) => (
                    <label
                      key={brand.id}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedBrandIds.includes(brand.id) ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                    >
                      <Checkbox checked={selectedBrandIds.includes(brand.id)} onCheckedChange={() => toggleBrand(brand.id)} />
                      <span className="text-sm font-medium">{brand.name}</span>
                    </label>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  placeholder="Add other brand…"
                  value={customBrandInput}
                  onChange={(e) => setCustomBrandInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomBrand(); } }}
                  className="h-10"
                />
                <Button type="button" variant="outline" size="sm" onClick={addCustomBrand} className="h-10 px-3 shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {customBrands.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {customBrands.map((name) => (
                    <Badge key={name} variant="secondary" className="gap-1 pr-1">
                      {name}
                      <button type="button" onClick={() => setCustomBrands((p) => p.filter((b) => b !== name))} className="ml-0.5 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {brandsError && <p className="text-sm text-destructive">{brandsError}</p>}
              {totalBrandsSelected > 0 && (
                <p className="text-xs text-muted-foreground">{totalBrandsSelected} brand{totalBrandsSelected !== 1 ? "s" : ""} selected</p>
              )}
            </CardContent>
          </Card>

          {/* Outcome */}
          <Card className="border-none shadow-md bg-card/50">
            <CardContent className="p-5 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Outcome</p>

              <FormField control={form.control} name="feedback" render={({ field }) => (
                <FormItem>
                  <FormLabel>Feedback *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Select outcome" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Interested">Interested</SelectItem>
                      <SelectItem value="Potential">Potential</SelectItem>
                      <SelectItem value="Not Interested">Not Interested</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes *</FormLabel>
                  <FormControl>
                    <Textarea placeholder="What was discussed? Any follow-up needed?" rows={3} {...field} className="resize-none" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Photo */}
          <Card className="border-none shadow-md bg-card/50">
            <CardContent className="p-5 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Site Photo *</p>

              <FormField control={form.control} name="image_url" render={() => (
                <FormItem>
                  {imagePreview ? (
                    <div className="relative rounded-xl overflow-hidden border">
                      <img src={imagePreview} alt="Site preview" className="w-full h-48 object-cover" />
                      {uploadingImage && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Loader2 className="h-6 w-6 text-white animate-spin" />
                        </div>
                      )}
                      {!uploadingImage && (
                        <button type="button" onClick={removeImage} className="absolute top-2 right-2 bg-black/50 rounded-full p-1 text-white hover:bg-black/70">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-muted-foreground/30 rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors">
                      <Camera className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm font-medium">Take or upload a photo</span>
                      <span className="text-xs text-muted-foreground mt-1">Tap to open camera</span>
                      <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleImageChange} />
                    </label>
                  )}
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Button
            type="submit"
            className="w-full h-14 text-base font-semibold shadow-lg shadow-primary/25"
            disabled={submitting || uploadingImage}
          >
            {submitting
              ? <><Loader2 className="h-5 w-5 animate-spin mr-2" />Saving visit…</>
              : "Save Visit"
            }
          </Button>

        </form>
      </Form>
    </div>
  );
}
