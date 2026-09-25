"use client";
import {useState} from "react";
import {MedicineSearch} from "../medicine-search";
export function DirectorySearch({label}:{label:string}) {
 const [query,setQuery]=useState("");
 return <MedicineSearch name="q" label={label} value={query} onChange={setQuery} onSelect={m=>{window.location.assign(`/portal?q=${encodeURIComponent(m.name)}`);}}/>;
}
